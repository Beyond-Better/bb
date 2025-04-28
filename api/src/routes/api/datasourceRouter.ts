import { Router } from '@oak/oak';
import { getDsProviders } from './dataSource.handlers.ts';

const datasourceRouter = new Router();

// Data source routes
datasourceRouter
	.get('/types', getDsProviders);

export default datasourceRouter;
