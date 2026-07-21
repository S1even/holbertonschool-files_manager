import pkg from 'mongodb';
import crypto from 'crypto';

const { MongoClient, ObjectID } = pkg;

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';

class DBClient {
  constructor() {
    MongoClient.connect(`mongodb://${host}:${port}`, { useUnifiedTopology: true }, (err, client) => {
      if (err) {
        console.log(err.message);
        this.db = false;
      }
      this.db = client.db(database);
    });
  }

  isAlive() {
    return !!this.db;
  }

  async nbUsers() {
    const collection = this.db.collection('users');
    const usersCount = await collection.countDocuments();
    return usersCount;
  }

  async nbFiles() {
    const collection = this.db.collection('files');
    const filesCount = await collection.countDocuments();
    return filesCount;
  }

  async insertNewUser(userEmail, userPass) {
    const collection = this.db.collection('users');
    const passHash = crypto.createHash('sha1').update(userPass).digest('hex');
    const insertResult = await collection.insertOne({ email: userEmail, password: passHash });
    return { email: userEmail, id: insertResult.insertedId };
  }

  async userEmailExist(userEmail) {
    const collection = this.db.collection('users');
    const email = await collection.findOne({ email: userEmail });
    return !!(email);
  }

  async getUser(userEmail, userPass) {
    const collection = this.db.collection('users');
    const passHash = crypto.createHash('sha1').update(userPass).digest('hex');
    const user = await collection.findOne({ email: userEmail, password: passHash });
    return (user) ? { id: user._id } : false;
  }

  async getUserById(userId) {
    const collection = this.db.collection('users');
    const user = await collection.findOne({ _id: ObjectID(userId) });

    return (user) ? { id: user._id, email: user.email } : false;
  }

  async getFileById(fileId) {
    const collection = this.db.collection('files');
    const file = await collection.findOne({ _id: ObjectID(fileId) });
    return (file) || false;
  }

  async insertFiles(file) {
    const collection = this.db.collection('files');
    const insert = await collection.insertOne(file);
    const dbFile = this.getFileById(insert.insertedId);
    return (dbFile) || false;
  }

  async getFile(userId, fileId) {
    const collection = this.db.collection('files');
    const file = await collection.findOne({ _id: ObjectID(fileId), userId });
    return (file) || false;
  }

  async getAllFilesIndex(userId, parentId, page, maxItem) {
    const collection = this.db.collection('files');
    const pageInt = parseInt(page, 10);
    const skip = pageInt * maxItem;
    const filesIndex = await collection.find({ userId, parentId })
      .skip(skip).limit(maxItem).toArray();
    return filesIndex;
  }

  async updatePublishFileStatus(fileId, fileStatus) {
    const collection = this.db.collection('files');
    const update = await collection.updateOne(
      { _id: ObjectID(fileId) },
      { $set: { isPublic: fileStatus } },
    );
    return (update) || false;
  }
}

const dbClient = new DBClient();
export { dbClient as default };