import mongoose from 'mongoose';
import { ENV } from '../constants.js';

export const connectMongo = () => mongoose.connect(ENV.MONGODB_URI);
export const mongoReady = () => mongoose.connection.readyState === 1;
