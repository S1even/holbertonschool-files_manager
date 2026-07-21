import express from 'express';
import router from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(router);
app.use((err, request, response, next) => { // eslint-disable-line no-unused-vars
  if (response.headersSent) {
    next(err);
    return;
  }

  response.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
