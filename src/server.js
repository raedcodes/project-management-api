//server.js imports the app and calls listen(). This is the entry point.
import "dotenv/config";
import app from "./app.js";
import { startScheduler } from "./jobs/scheduler.js";

// Set port
const port = process.env.PORT || 3000;

// Start server
app.listen(port, (error) => {
  if (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
  console.log(`Server is running on port ${port}`);
  startScheduler();
});
