fn main() {
    // Include the update helper script in macOS builds
    #[cfg(target_os = "macos")]
    {
        use std::env;
        use std::fs;
        use std::path::Path;
        
        let out_dir = env::var("OUT_DIR").expect("OUT_DIR not set");
        let dest_path = Path::new(&out_dir).join("update-helper.sh");
        
        // Copy the helper script to the build output
        fs::copy("../update-helper.sh", &dest_path)
            .expect("Failed to copy update-helper.sh");
        
        println!("cargo:rerun-if-changed=../update-helper.sh");
        println!("cargo:rustc-env=UPDATE_HELPER_SCRIPT={}", dest_path.display());
    }
    
    tauri_build::build()
}
