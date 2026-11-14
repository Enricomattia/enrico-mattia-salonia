import {readPublication,publicationStore} from '../lib/pathos-publication.mjs';

export const config={
  path:'/pathos-share/:id',
  rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain']}
};

export default (request,context)=>readPublication(request,context.params.id,()=>publicationStore(context));
