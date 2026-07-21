import { Router } from 'express';
import AppController from '../controllers/AppController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';
import UsersController from '../controllers/UsersController';

const router = Router();
const asyncHandler = (controller) => async (request, response, next) => {
  try {
    await controller(request, response, next);
  } catch (err) {
    next(err);
  }
};

router.get('/status', AppController.getStatus);
router.get('/stats', asyncHandler(AppController.getStats));
router.post('/users', asyncHandler(UsersController.postNew));
router.get('/connect', asyncHandler(AuthController.getConnect));
router.get('/disconnect', asyncHandler(AuthController.getDisconnect));
router.get('/users/me', asyncHandler(UsersController.getMe));
router.post('/files', asyncHandler(FilesController.postUpload));
router.put('/files/:id/publish', asyncHandler(FilesController.putPublish));
router.put('/files/:id/unpublish', asyncHandler(FilesController.putUnpublish));
router.get('/files/:id/data', asyncHandler(FilesController.getFile));
router.get('/files/:id', asyncHandler(FilesController.getShow));
router.get('/files', asyncHandler(FilesController.getIndex));

export default router;
