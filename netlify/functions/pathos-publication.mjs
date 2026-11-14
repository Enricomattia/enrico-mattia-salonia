import {managePublication,publicationStore} from '../lib/pathos-publication.mjs';

export const config={
  path:'/api/pathos-personal/publication/:id',
  method:['GET','PUT','DELETE'],
  rateLimit:{windowLimit:15,windowSize:60,aggregateBy:['ip','domain']}
};

export default (request,context)=>managePublication(request,context.params.id,()=>publicationStore(context));
