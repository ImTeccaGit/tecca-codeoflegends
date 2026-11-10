//! Jungle routes and practice attempts on temporary databases.

use crate::error::AppError;
use crate::jungle::dto::{AttemptInput, RouteInput};
use crate::jungle::repository;
use crate::test_support::TempDb;

fn camps(ids: &[&str]) -> Vec<String> {
    ids.iter().map(|id| id.to_string()).collect()
}

fn route(name: &str, side: &str, ids: &[&str]) -> RouteInput {
    RouteInput {
        id: None,
        name: name.to_string(),
        side: side.to_string(),
        camps: camps(ids),
        notes: None,
        champion_id: None,
    }
}

fn attempt(ids: &[&str], splits: &[i64]) -> AttemptInput {
    AttemptInput {
        route_key: "blue-full-red-start".to_string(),
        route_name: "Full Clear · Red start".to_string(),
        side: "blue".to_string(),
        camps: camps(ids),
        splits_ms: splits.to_vec(),
        champion_id: None,
    }
}

#[test]
fn custom_routes_can_be_created_updated_and_deleted() {
    let temp = TempDb::new("jungle-routes");
    let db = temp.open();

    let created = db
        .with_connection(|conn| {
            repository::save_route(
                conn,
                &route(
                    "  Mio clear ",
                    "blue",
                    &["blue-red", "blue-krugs", "blue-raptors"],
                ),
            )
        })
        .unwrap();
    assert!(created.id.starts_with("custom-"));
    assert_eq!(created.name, "Mio clear", "name is trimmed");
    assert_eq!(created.camps, ["blue-red", "blue-krugs", "blue-raptors"]);

    let mut update = route("Mio clear v2", "blue", &["blue-blue", "blue-gromp"]);
    update.id = Some(created.id.clone());
    update.notes = Some("  Smite sul secondo campo  ".to_string());
    let updated = db
        .with_connection(|conn| repository::save_route(conn, &update))
        .unwrap();
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.camps, ["blue-blue", "blue-gromp"]);
    assert_eq!(updated.notes.as_deref(), Some("Smite sul secondo campo"));

    let routes = db
        .with_connection(|conn| repository::list_routes(conn))
        .unwrap();
    assert_eq!(routes.len(), 1);

    db.with_connection(|conn| repository::delete_route(conn, &created.id))
        .unwrap();
    assert!(db
        .with_connection(|conn| repository::list_routes(conn))
        .unwrap()
        .is_empty());
    assert!(db
        .with_connection(|conn| repository::delete_route(conn, &created.id))
        .is_err());
}

#[test]
fn route_validation_rejects_bad_input() {
    let temp = TempDb::new("jungle-route-validation");
    let db = temp.open();
    let cases = [
        route("", "blue", &["blue-red", "blue-krugs"]),
        route("Nome", "purple", &["blue-red", "blue-krugs"]),
        route("Nome", "blue", &["blue-red"]),
        route("Nome", "blue", &["blue-red", "blue-red"]),
        route("Nome", "blue", &["blue-red", "dragon"]),
        route(&"x".repeat(61), "blue", &["blue-red", "blue-krugs"]),
    ];
    for case in cases {
        let result = db.with_connection(|conn| repository::save_route(conn, &case));
        assert!(matches!(result, Err(AppError::Validation(_))), "{case:?}");
    }

    let mut unknown_champion = route("Nome", "blue", &["blue-red", "blue-krugs"]);
    unknown_champion.champion_id = Some(4242);
    assert!(db
        .with_connection(|conn| repository::save_route(conn, &unknown_champion))
        .is_err());

    let mut missing = route("Nome", "blue", &["blue-red", "blue-krugs"]);
    missing.id = Some("custom-missing".to_string());
    assert!(db
        .with_connection(|conn| repository::save_route(conn, &missing))
        .is_err());
}

#[test]
fn attempts_store_splits_and_derive_total() {
    let temp = TempDb::new("jungle-attempts");
    let db = temp.open();

    let saved = db
        .with_connection(|conn| {
            repository::save_attempt(
                conn,
                &attempt(
                    &["blue-red", "blue-krugs", "blue-raptors"],
                    &[25_000, 52_500, 81_200],
                ),
            )
        })
        .unwrap();

    assert_eq!(saved.total_ms, 81_200, "total = last split");
    assert_eq!(saved.splits.len(), 3);
    assert_eq!(saved.splits[1].camp_id, "blue-krugs");
    assert_eq!(saved.splits[1].split_ms, 52_500);
    assert_eq!(saved.route_name, "Full Clear · Red start");

    let second = db
        .with_connection(|conn| {
            repository::save_attempt(
                conn,
                &attempt(&["blue-red", "blue-krugs"], &[20_000, 40_000]),
            )
        })
        .unwrap();
    let all = db
        .with_connection(|conn| repository::list_attempts(conn))
        .unwrap();
    assert_eq!(all.len(), 2);
    assert_eq!(all[0].id, second.id, "newest first");

    db.with_connection(|conn| repository::delete_attempt(conn, saved.id))
        .unwrap();
    let remaining_splits: i64 = db
        .with_connection(|conn| {
            Ok(
                conn.query_row("SELECT COUNT(*) FROM jungle_clear_splits", [], |row| {
                    row.get(0)
                })?,
            )
        })
        .unwrap();
    assert_eq!(remaining_splits, 2, "splits are deleted with their attempt");
}

#[test]
fn attempt_validation_rejects_inconsistent_times() {
    let temp = TempDb::new("jungle-attempt-validation");
    let db = temp.open();
    let cases = [
        attempt(&["blue-red", "blue-krugs"], &[25_000]),
        attempt(&["blue-red", "blue-krugs"], &[25_000, 25_000]),
        attempt(&["blue-red", "blue-krugs"], &[30_000, 20_000]),
        attempt(&["blue-red"], &[0]),
        attempt(&["blue-red"], &[1_800_001]),
        attempt(&["nowhere"], &[10_000]),
    ];
    for case in cases {
        let result = db.with_connection(|conn| repository::save_attempt(conn, &case));
        assert!(matches!(result, Err(AppError::Validation(_))), "{case:?}");
    }
    assert!(db
        .with_connection(|conn| repository::list_attempts(conn))
        .unwrap()
        .is_empty());
}

#[test]
fn attempts_keep_their_route_snapshot_after_route_deletion() {
    let temp = TempDb::new("jungle-snapshot");
    let db = temp.open();

    let custom = db
        .with_connection(|conn| {
            repository::save_route(
                conn,
                &route("Invasione", "red", &["red-blue", "blue-raptors"]),
            )
        })
        .unwrap();
    let mut input = attempt(&["red-blue", "blue-raptors"], &[30_000, 70_000]);
    input.route_key = custom.id.clone();
    input.route_name = custom.name.clone();
    input.side = "red".to_string();
    db.with_connection(|conn| repository::save_attempt(conn, &input))
        .unwrap();

    db.with_connection(|conn| repository::delete_route(conn, &custom.id))
        .unwrap();
    let attempts = db
        .with_connection(|conn| repository::list_attempts(conn))
        .unwrap();
    assert_eq!(attempts.len(), 1);
    assert_eq!(attempts[0].route_name, "Invasione");
    assert_eq!(attempts[0].camps, ["red-blue", "blue-raptors"]);
}
