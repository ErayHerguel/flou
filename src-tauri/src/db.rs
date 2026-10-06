use std::time::Duration;

use serde::Deserialize;
use serde_json::Value;
use sqlx::query::Query;
use sqlx::sqlite::{
    SqliteArguments, SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions,
    SqliteSynchronous,
};
use sqlx::Sqlite;
use tauri::{AppHandle, State};
use tokio::sync::OnceCell;

use crate::paths::db_path;

/// Schreibverbindung zur App-Datenbank.
///
/// tauri-plugin-sql verteilt Anfragen auf einen Pool, daher sind mehrteilige Schreibvorgänge
/// darüber nicht atomar. Alle Schreibvorgänge laufen deshalb über diese eine Verbindung
/// in echten Transaktionen. Die Datei liegt im WAL-Modus, Leser des Plugins sehen stets
/// einen konsistenten Stand.
pub struct Db {
    pool: OnceCell<SqlitePool>,
}

impl Db {
    pub fn new() -> Self {
        Self {
            pool: OnceCell::new(),
        }
    }

    pub async fn pool(&self, app: &AppHandle) -> Result<&SqlitePool, String> {
        self.pool
            .get_or_try_init(|| async {
                let path = db_path(app)?;
                if !path.exists() {
                    return Err("Datenbank wurde noch nicht initialisiert".to_string());
                }
                let options = SqliteConnectOptions::new()
                    .filename(path)
                    .create_if_missing(false)
                    .journal_mode(SqliteJournalMode::Wal)
                    .synchronous(SqliteSynchronous::Normal)
                    .foreign_keys(true)
                    .busy_timeout(Duration::from_secs(10));
                SqlitePoolOptions::new()
                    .max_connections(1)
                    .connect_with(options)
                    .await
                    .map_err(|e| e.to_string())
            })
            .await
    }
}

#[derive(Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<Value>,
}

fn bind<'q>(
    query: Query<'q, Sqlite, SqliteArguments<'q>>,
    value: &'q Value,
) -> Query<'q, Sqlite, SqliteArguments<'q>> {
    match value {
        Value::Null => query.bind(None::<String>),
        Value::Bool(b) => query.bind(i64::from(*b)),
        Value::Number(n) => match n.as_i64() {
            Some(i) => query.bind(i),
            None => query.bind(n.as_f64()),
        },
        Value::String(s) => query.bind(s.as_str()),
        other => query.bind(other.to_string()),
    }
}

/// Führt alle Anweisungen in einer Transaktion aus: entweder alle oder keine.
#[tauri::command]
pub async fn db_tx(
    app: AppHandle,
    db: State<'_, Db>,
    statements: Vec<Statement>,
) -> Result<(), String> {
    let pool = db.pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for statement in &statements {
        let mut query = sqlx::query(&statement.sql);
        for param in &statement.params {
            query = bind(query, param);
        }
        query
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("{e} ({})", statement.sql))?;
    }
    tx.commit().await.map_err(|e| e.to_string())
}
