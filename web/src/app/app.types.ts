import { roleViews } from './app.constants';

export type RoleView = (typeof roleViews)[number]['role'];
