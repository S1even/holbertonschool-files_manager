import { promises as fs } from 'fs';
import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import mongodb from 'mongodb';
import dbClient from './utils/db.mjs'; // eslint-disable-line import/extensions

const { ObjectID } = mongodb;
const fileQueue = new Bull('fileQueue');
const thumbnailSizes = [500, 250, 100];
const waitConnection = () => new Promise((resolve, reject) => {
  let attempts = 0;

  const repeat = () => {
    setTimeout(() => {
      attempts += 1;

      if (dbClient.isAlive()) {
        resolve();
      } else if (attempts >= 10) {
        reject(new Error('MongoDB connection failed'));
      } else {
        repeat();
      }
    }, 1000);
  };

  repeat();
});

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  if (!ObjectID.isValid(fileId) || !ObjectID.isValid(userId)) {
    throw new Error('File not found');
  }

  await waitConnection();

  const file = await dbClient.db.collection('files').findOne({
    _id: new ObjectID(fileId),
    userId: new ObjectID(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  await Promise.all(thumbnailSizes.map(async (width) => {
    const thumbnail = await imageThumbnail(file.localPath, { width });

    await fs.writeFile(`${file.localPath}_${width}`, thumbnail);
  }));
});
