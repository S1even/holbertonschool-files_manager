import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const fs = require('fs');
const mime = require('mime-types');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async postUpload(req, res) {
    const key = req.header('X-Token');
    const session = await redisClient.get(`auth_${key}`);
    if (!key || key.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session) {
      const {
        name,
        type,
        isPublic,
        data,
      } = req.body;
      let { parentId } = req.body;
      const types = ['folder', 'file', 'image'];

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }
      if (!type || !types.includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (!data && type !== 'folder') {
        return res.status(400).json({ error: 'Missing data' });
      }
      if (!parentId) {
        parentId = '0';
      }
      if (parentId !== '0') {
        const search = await dbClient.db.collection('files').find({ _id: ObjectId(parentId) }).toArray();
        if (search.length < 1) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (search[0].type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }
      const userId = session;
      if (type === 'folder') {
        const folder = await dbClient.db.collection('files').insertOne({
          name,
          type,
          userId: ObjectId(userId),
          parentId: parentId !== '0' ? ObjectId(parentId) : '0',
          isPublic: isPublic || false,
        });
        return res.status(201).json({
          id: folder.ops[0]._id,
          userId: folder.ops[0].userId,
          name: folder.ops[0].name,
          type: folder.ops[0].type,
          isPublic: folder.ops[0].isPublic,
          parentId: folder.ops[0].parentId,
        });
      }

      const buff = Buffer.from(data, 'base64').toString('utf-8');
      const path = process.env.FOLDER_PATH || '/tmp/files_manager';
      const newFile = uuidv4();

      if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
      }
      try {
        fs.writeFileSync(`${path}/${newFile}`, buff);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      const file = await dbClient.db.collection('files').insertOne({
        name,
        type,
        userId: ObjectId(userId),
        parentId: parentId !== '0' ? ObjectId(parentId) : '0',
        isPublic: isPublic || false,
        localPath: `${path}/${newFile}`,
      });

      return res.status(201).json({
        id: file.ops[0]._id,
        userId: file.ops[0].userId,
        name: file.ops[0].name,
        type: file.ops[0].type,
        isPublic: file.ops[0].isPublic,
        parentId: file.ops[0].parentId,
      });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  static async getShow(req, res) {
    const key = req.header('X-Token');
    const session = await redisClient.get(`auth_${key}`);
    if (!key || key.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session) {
      const { id } = req.params;
      try {
        const search = await dbClient.db.collection('files').find({
          _id: ObjectId(id),
          userId: ObjectId(session),
        }).toArray();
        if (!search || search.length < 1) {
          return res.status(404).json({ error: 'Not found' });
        }
        return res.json({
          id: search[0]._id,
          userId: search[0].userId,
          name: search[0].name,
          type: search[0].type,
          isPublic: search[0].isPublic,
          parentId: search[0].parentId,
        });
      } catch (e) {
        return res.status(404).json({ error: 'Not found' });
      }
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  static async getIndex(req, res) {
    const key = req.header('X-Token');
    const session = await redisClient.get(`auth_${key}`);
    if (!key || key.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session) {
      let { parentId, page } = req.query;
      if (!parentId) parentId = '0';
      page = parseInt(page, 10) || 0;
      const limit = 20;
      const skip = page * limit;

      try {
        const query = {
          parentId: parentId === '0' ? '0' : ObjectId(parentId),
          userId: ObjectId(session),
        };
        const search = await dbClient.db.collection('files').find(query).skip(skip).limit(limit)
          .toArray();
        return res.status(200).send(search);
      } catch (e) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  static async putPublish(req, res) {
    return FilesController.updatePublicStatus(req, res, true);
  }

  static async putUnpublish(req, res) {
    return FilesController.updatePublicStatus(req, res, false);
  }

  static async updatePublicStatus(req, res, isPublic) {
    const key = req.header('X-Token');
    const session = await redisClient.get(`auth_${key}`);
    if (!key || key.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session) {
      const { id } = req.params;
      if (!id || id === '') {
        return res.status(404).json({ error: 'Not found' });
      }
      try {
        const search = await dbClient.db.collection('files').find({
          _id: ObjectId(id),
          userId: ObjectId(session),
        }).toArray();
        if (!search || search.length < 1) {
          return res.status(404).json({ error: 'Not found' });
        }
        await dbClient.db.collection('files').updateOne(
          { _id: ObjectId(id) },
          { $set: { isPublic } },
        );
        const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });
        return res.status(200).json({
          id: updatedFile._id,
          userId: updatedFile.userId,
          name: updatedFile.name,
          type: updatedFile.type,
          isPublic: updatedFile.isPublic,
          parentId: updatedFile.parentId,
        });
      } catch (e) {
        return res.status(404).json({ error: 'Not found' });
      }
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  static async getFile(req, res) {
    const { id } = req.params;
    if (!id || id === '') {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      if (file.type === 'folder') {
        return res.status(400).json({ error: 'A folder doesn\'t have content' });
      }
      if (!file.isPublic) {
        const key = req.header('X-Token');
        const session = await redisClient.get(`auth_${key}`);
        if (!session || String(file.userId) !== session) {
          return res.status(404).json({ error: 'Not found' });
        }
      }

      if (!fs.existsSync(file.localPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const mimeType = mime.contentType(file.name) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      const data = fs.readFileSync(file.localPath);
      return res.send(data);
    } catch (e) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

module.exports = FilesController;