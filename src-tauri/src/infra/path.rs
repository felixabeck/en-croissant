#![allow(dead_code)]

use crate::error::Error;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub fn validate_regular_file(path: &Path) -> Result<(), Error> {
    if !path.exists() {
        return Err(Error::InvalidInput("Path does not exist".into()));
    }
    let metadata = std::fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() {
        return Err(Error::InvalidInput("Symlinks are not allowed".into()));
    }
    if !metadata.is_file() {
        return Err(Error::InvalidInput("Not a regular file".into()));
    }
    Ok(())
}

pub fn validate_directory(path: &Path) -> Result<(), Error> {
    if !path.exists() {
        return Err(Error::InvalidInput("Path does not exist".into()));
    }
    let metadata = std::fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() {
        return Err(Error::InvalidInput("Symlinks are not allowed".into()));
    }
    if !metadata.is_dir() {
        return Err(Error::InvalidInput("Not a directory".into()));
    }
    Ok(())
}

pub fn to_utf8_str(path: &Path) -> Result<&str, Error> {
    path.to_str()
        .ok_or_else(|| Error::InvalidInput("Path is not valid UTF-8".into()))
}

pub fn check_extension(path: &Path, expected: &str) -> Result<(), Error> {
    if path.extension().and_then(|e| e.to_str()) != Some(expected) {
        return Err(Error::InvalidInput(format!(
            "Expected extension {}",
            expected
        )));
    }
    Ok(())
}

pub fn canonical_compare(a: &Path, b: &Path) -> Result<bool, Error> {
    let ca = safe_canonicalize(a)?;
    let cb = safe_canonicalize(b)?;
    Ok(ca == cb)
}

pub fn safe_canonicalize(path: &Path) -> Result<PathBuf, Error> {
    if path.exists() {
        let meta = std::fs::symlink_metadata(path)?;
        if meta.is_symlink() {
            return Err(Error::InvalidInput("Symlink target is not allowed".into()));
        }
        let canon = std::fs::canonicalize(path)?;
        return Ok(canon);
    }

    let mut current = path.to_path_buf();
    let mut components_to_add = Vec::new();
    while !current.exists() {
        if let Some(file_name) = current.file_name() {
            components_to_add.push(file_name.to_os_string());
        } else {
            return Err(Error::InvalidInput("Invalid path component".into()));
        }
        if !current.pop() {
            break;
        }
    }

    if !current.exists() {
        return Err(Error::InvalidInput("No existing ancestor".into()));
    }

    let mut canon = std::fs::canonicalize(&current)?;
    for comp in components_to_add.into_iter().rev() {
        canon.push(comp);
    }

    Ok(canon)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthorizedPath(PathBuf);

impl AuthorizedPath {
    pub fn parse(app: &AppHandle, path_str: &str) -> Result<Self, Error> {
        if let Some(rest) = path_str.strip_prefix("grant:") {
            let state: tauri::State<crate::AppState> = app.state();
            if let Some(granted_path) = state.path_grants.resolve(rest) {
                let canon = safe_canonicalize(&granted_path)?;
                return Ok(AuthorizedPath(canon));
            }
            return Err(Error::InvalidInput("Invalid or expired path grant".into()));
        }

        let path = PathBuf::from(path_str);
        if !path.is_absolute() {
            return Err(Error::InvalidInput("Path must be absolute".into()));
        }

        let canon = safe_canonicalize(&path)?;
        let path_resolver = app.path();

        let mut allowed_roots = Vec::new();
        if let Ok(p) = path_resolver.app_data_dir() {
            allowed_roots.push(p);
        }
        if let Ok(p) = path_resolver.app_config_dir() {
            allowed_roots.push(p);
        }
        if let Ok(p) = path_resolver.app_local_data_dir() {
            allowed_roots.push(p);
        }
        if let Ok(p) = path_resolver.app_log_dir() {
            allowed_roots.push(p);
        }
        if let Ok(p) = path_resolver.document_dir() {
            allowed_roots.push(p);
        }
        if let Ok(p) = path_resolver.download_dir() {
            allowed_roots.push(p);
        }
        if let Ok(p) = path_resolver.home_dir() {
            allowed_roots.push(p.join("EnCroissant"));
        }

        for root in allowed_roots {
            if let Ok(canon_root) = safe_canonicalize(&root) {
                if canon.starts_with(&canon_root) {
                    return Ok(AuthorizedPath(canon));
                }
            } else {
                // If root doesn't exist, just normalize and check starts_with
                let mut normalized_root = PathBuf::new();
                for component in root.components() {
                    match component {
                        std::path::Component::ParentDir => {
                            normalized_root.pop();
                        }
                        std::path::Component::CurDir => {}
                        _ => {
                            normalized_root.push(component);
                        }
                    }
                }
                if canon.starts_with(&normalized_root) {
                    return Ok(AuthorizedPath(canon));
                }
            }
        }

        Err(Error::InvalidInput("Path is not authorized".into()))
    }

    pub fn as_path(&self) -> &Path {
        &self.0
    }

    pub fn into_inner(self) -> PathBuf {
        self.0
    }
}

pub struct Grant {
    pub path: PathBuf,
    pub expires_at: Instant,
}

pub struct PathGrants {
    grants: dashmap::DashMap<String, Grant>,
    max_capacity: usize,
}

impl Default for PathGrants {
    fn default() -> Self {
        Self {
            grants: dashmap::DashMap::new(),
            max_capacity: 1000,
        }
    }
}

impl PathGrants {
    pub fn resolve(&self, token: &str) -> Option<PathBuf> {
        let entry = self.grants.get(token)?;
        if Instant::now() > entry.expires_at {
            return None;
        }
        Some(entry.path.clone())
    }

    pub fn grant(&self, path: PathBuf) -> String {
        self.evict_expired();
        if self.grants.len() >= self.max_capacity {
            self.grants.clear(); // Restart policy on exhaustion
        }

        let token = uuid::Uuid::new_v4().to_string();
        self.grants.insert(
            token.clone(),
            Grant {
                path,
                expires_at: Instant::now() + Duration::from_secs(3600), // 1 hour expiry
            },
        );
        token
    }

    pub fn revoke(&self, token: &str) {
        self.grants.remove(token);
    }

    fn evict_expired(&self) {
        let mut to_remove = Vec::new();
        let now = Instant::now();
        for item in self.grants.iter() {
            if now > item.value().expires_at {
                to_remove.push(item.key().clone());
            }
        }
        for k in to_remove {
            self.grants.remove(&k);
        }
    }
}
