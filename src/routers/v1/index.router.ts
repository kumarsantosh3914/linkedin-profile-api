import express from 'express';
import pingRouter from './ping.router';
import profileRouter from './profile.router';

const v1Router = express.Router();

v1Router.use('/ping', pingRouter);
v1Router.use('/profile', profileRouter);

export default v1Router;