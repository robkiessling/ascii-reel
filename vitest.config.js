import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "happy-dom", // This app's ES modules depend on dom methods
        include: ["src/**/*.test.js"],
        globals: true, // Allows using test(), expect(), etc. without imports
        coverage: {
            reporter: ["text", "html"],
        },
        setupFiles: ['./vitest.setup.js'] // Need to preload jquery for this app's ES modules to load correctly
    },
});