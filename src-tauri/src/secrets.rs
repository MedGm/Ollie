use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

const SERVICE: &str = "ollie";
const PROBE_ID: &str = "__ollie_probe__";

pub trait KeyringBackend: Send + Sync {
    fn get(&self, provider_id: &str) -> Result<Option<String>, String>;
    fn set(&self, provider_id: &str, key: &str) -> Result<(), String>;
    fn delete(&self, provider_id: &str) -> Result<(), String>;
}

pub struct SystemKeyring;

impl KeyringBackend for SystemKeyring {
    fn get(&self, provider_id: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(SERVICE, provider_id).map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(pw) => Ok(Some(pw)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    fn set(&self, provider_id: &str, key: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(SERVICE, provider_id).map_err(|e| e.to_string())?;
        entry.set_password(key).map_err(|e| e.to_string())
    }

    fn delete(&self, provider_id: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(SERVICE, provider_id).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[derive(Default)]
pub struct FakeKeyring(Mutex<HashMap<String, String>>);

impl KeyringBackend for FakeKeyring {
    fn get(&self, provider_id: &str) -> Result<Option<String>, String> {
        Ok(self.0.lock().unwrap().get(provider_id).cloned())
    }
    fn set(&self, provider_id: &str, key: &str) -> Result<(), String> {
        self.0.lock().unwrap().insert(provider_id.to_string(), key.to_string());
        Ok(())
    }
    fn delete(&self, provider_id: &str) -> Result<(), String> {
        self.0.lock().unwrap().remove(provider_id);
        Ok(())
    }
}

/// Always returns `Err` — used in tests to exercise the fallback-to-plaintext path.
#[derive(Default)]
pub struct FailingKeyring;

impl KeyringBackend for FailingKeyring {
    fn get(&self, _provider_id: &str) -> Result<Option<String>, String> { Err("keyring unavailable".into()) }
    fn set(&self, _provider_id: &str, _key: &str) -> Result<(), String> { Err("keyring unavailable".into()) }
    fn delete(&self, _provider_id: &str) -> Result<(), String> { Err("keyring unavailable".into()) }
}

/// Pure probe, no caching — used directly in tests.
pub fn probe(backend: &dyn KeyringBackend) -> bool {
    backend.set(PROBE_ID, "probe").is_ok() && backend.delete(PROBE_ID).is_ok()
}

static AVAILABLE: OnceLock<bool> = OnceLock::new();

/// Cached probe — call from command handlers so the real Secret Service
/// is only hit once per process, not once per settings read/write.
pub fn is_available_cached(backend: &dyn KeyringBackend) -> bool {
    *AVAILABLE.get_or_init(|| probe(backend))
}

/// Tauri managed state wrapping whichever backend the app is running with.
pub struct KeyringState(pub Arc<dyn KeyringBackend>);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fake_keyring_round_trip() {
        let kr = FakeKeyring::default();
        assert_eq!(kr.get("p1").unwrap(), None);
        kr.set("p1", "secret-123").unwrap();
        assert_eq!(kr.get("p1").unwrap(), Some("secret-123".to_string()));
        kr.delete("p1").unwrap();
        assert_eq!(kr.get("p1").unwrap(), None);
    }

    #[test]
    fn probe_succeeds_and_cleans_up_after_itself() {
        let kr = FakeKeyring::default();
        assert!(probe(&kr));
        assert_eq!(kr.get(PROBE_ID).unwrap(), None);
    }

    #[test]
    fn probe_fails_against_failing_backend() {
        let kr = FailingKeyring;
        assert!(!probe(&kr));
    }
}
