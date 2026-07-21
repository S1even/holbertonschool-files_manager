import { promises as fs } from 'fs';
import mongodb from 'mongodb';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db.mjs'; // eslint-disable-line import/extensions
import redisClient from '../utils/redis.mjs'; // eslint-disable-line import/extensions

const { ObjectID } = mongodb;
const acceptedTypes = ['folder', 'file', 'image'];
const formatFile = (file) => ({
  id: file._id.toString(),
  userId: file.userId.toString(),
  name: file.name,
  type: file.type,
  isPublic: file.isPublic || false,
  parentId: file.parentId && file.parentId !== '0' ? file.parentId.toString() : 0,
});
const withTimeout = (promise, timeout = 1000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Operation timed out')), timeout);

  promise
    .then((value) => {
      clearTimeout(timer);
      resolve(value);
    })
    .catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
});

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');

    if (!token) {
      return null;
    }

    try {
      const userId = await withTimeout(redisClient.get(`auth_${token}`));

      if (!userId || !ObjectID.isValid(userId) || !dbClient.db) {
        return null;
      }

      return await withTimeout(dbClient.db.collection('users').findOne({
        _id: new ObjectID(userId),
      }));
    } catch (err) {
      return null;
    }
  }

  static async postUpload(request, response) {
    const user = await FilesController.getUser(request);

    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      name,
      type,
      data,
    } = request.body || {};
    const parentId = request.body && request.body.parentId !== undefined
      ? request.body.parentId
      : 0;
    const isPublic = request.body && request.body.isPublic !== undefined
      ? request.body.isPublic
      : false;

    if (!name) {
      response.status(400).json({ error: 'Missing name' });
      return;
    }

    if (!type || !acceptedTypes.includes(type)) {
      response.status(400).json({ error: 'Missing type' });
      return;
    }

    if (type !== 'folder' && !data) {
      response.status(400).json({ error: 'Missing data' });
      return;
    }

    const files = dbClient.db.collection('files');
    let fileParentId = 0;

    if (parentId !== 0 && parentId !== '0') {
      if (!ObjectID.isValid(parentId)) {
        response.status(400).json({ error: 'Parent not found' });
        return;
      }

      fileParentId = new ObjectID(parentId);
      const parentFile = await files.findOne({ _id: fileParentId });

      if (!parentFile) {
        response.status(400).json({ error: 'Parent not found' });
        return;
      }

      if (parentFile.type !== 'folder') {
        response.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }

    const file = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: fileParentId,
    };

    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const localPath = path.join(path.resolve(folderPath), uuidv4());

      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, Buffer.from(data, 'base64'));
      file.localPath = localPath;
    }

    const result = await files.insertOne(file);

    response.status(201).json(formatFile({
      ...file,
      _id: result.insertedId,
    }));
  }

  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    const { id } = request.params;

    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!ObjectID.isValid(id)) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectID(id),
      userId: user._id,
    });

    if (!file) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    response.status(200).json(formatFile(file));
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);

    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { parentId = 0 } = request.query;
    const page = Math.max(Number.parseInt(request.query.page || 0, 10) || 0, 0);
    let parentIdFilter = { $in: [0, '0'] };

    if (parentId !== 0 && parentId !== '0') {
      if (!ObjectID.isValid(parentId)) {
        response.status(200).json([]);
        return;
      }

      parentIdFilter = { $in: [new ObjectID(parentId), parentId] };
    }

    const files = await withTimeout(
      dbClient.db.collection('files')
        .find({ userId: user._id, parentId: parentIdFilter })
        .skip(page * 20)
        .limit(20)
        .toArray(),
    );

    response.status(200).json(files.map((file) => formatFile(file)));
  }
}

export default FilesController;
