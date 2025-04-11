import { Router } from '@oak/oak';
import { getDataSourceTypes } from './dataSource.handlers.ts';

const datasourceRouter = new Router();

// Data source routes
datasourceRouter
	.get('/types', getDataSourceTypes);

export default datasourceRouter;
