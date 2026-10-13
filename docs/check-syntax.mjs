import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
for(const file of readdirSync('scripts').filter(name=>name.endsWith('.js'))){const result=spawnSync(process.execPath,['--check','scripts/'+file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log('Todos os scripts JavaScript passaram pela verificação de sintaxe.');
