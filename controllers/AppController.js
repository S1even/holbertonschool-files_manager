import dbClient from '../utils/db.mjs'; // eslint-disable-line import/extensions
import redisClient from '../utils/redis.mjs'; // eslint-disable-line import/extensions

class AppController {
  static getStatus(request, response) {
    response.status(200).json({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  static async getStats(request, response) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();

    response.status(200).json({ users, files });
  }
}

export default AppController;
