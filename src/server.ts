import { app } from './app';
import { config } from './config';
import { initDatabase } from './model/database';

// Ensure database is initialized
initDatabase();

app.listen(config.port, () => {
  console.log(`Profit service server is running on http://localhost:${config.port}`);
});
