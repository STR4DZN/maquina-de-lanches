# Máquina de Lanches — 0.5.0

Módulo para **Foundry VTT 13**. O mestre marca uma área no mapa, configura a máquina e os jogadores dão **duplo clique na área** para comprar usando o saldo compartilhado do **Banco de Mana**. O mapa mostra somente contornos coloridos, sem marcadores com ícones ou nomes e sem criar uma aba de máquinas nos controles.

## Instalar ou atualizar

Em **Instalar módulo → URL do Manifesto**, use:

```text
https://github.com/STR4DZN/maquina-de-lanches/releases/latest/download/module.json
```

Para pagamentos, instale e ative também **Banco de Mana 2.3.0 ou posterior**:

```text
https://github.com/STR4DZN/holosuite-mana/releases/latest/download/module.json
```

Ative os dois módulos no mundo e recarregue todos os clientes com **F5**. O ID técnico `holosuite-vending` foi preservado para manter máquinas, produtos e estoques existentes. O manifesto não impõe dependências: a máquina pode abrir sem o banco, mas compras ficam bloqueadas até existir uma API de pagamentos compatível. Não há app de máquina no HoloSuite; o banco continua disponível pelo celular.

## Marcar, configurar e usar

1. Como mestre, abra os controles nativos de **Regiões** do mapa. Clique em **Criar máquina de vendas (retângulo)** e arraste a área; ou escolha **Criar máquina de vendas (polígono)** e marque os pontos. Duplo clique conclui o polígono. **Escape** cancela a vinculação.
2. Ao concluir, a região vira uma máquina, o Foundry volta à camada de Tokens e abre o gerenciamento.
3. Em **Produtos**, configure imagem, nome, categoria, quantidade, capacidade, preço em mana e opções de sorteio. Salve.
4. Em **Aparência e opções**, escolha a cor da máquina e demais opções. Em **Área no mapa**, localize, mova, redimensione ou redesenhe a mesma região. Catálogo e histórico são preservados. A cor da região define seu contorno no mapa.
5. O jogador dá **duplo clique dentro da área**, escolhe produto e quantidade e clica em **Comprar lanche**. Não exige token nem posição de personagem. É preciso estar na cena da máquina e ter um mestre conectado. Sessão pausada impede compras dos jogadores.
6. **Escolha por mim** sorteia uma unidade somente na categoria selecionada. O preço do sorteio é definido pelo mestre. **Pegar** apenas libera o compartimento de uma compra já confirmada, sem outro débito ou desconto de estoque.

Para editar depois, o mestre usa **Shift + duplo clique** na área ou seleciona a região e clica em **Configurar máquina da região selecionada**, em Regiões. Esse botão também vincula uma máquina a uma região comum já desenhada. Na camada de Regiões, o duplo clique sem Shift mantém a edição nativa. Não há botões de máquinas na camada de Tokens.

Os contornos acompanham movimento e zoom do mapa. O ponto do clique é testado pela região nativa, incluindo formatos e furos; quando áreas se sobrepõem, a menor tem prioridade. Cliques fora delas continuam disponíveis para o mapa.

## Produtos, imagens e estoque

A máquina tem vitrine, seleção por clique ou código e compartimento de entrega imediata, sem animação de queda ou coleta. Suporta até **200 produtos** com vitrines de nove produtos, busca, filtros, paginação e códigos de duas letras para catálogos maiores. O máximo por compra é configurável entre 1 e 100 unidades; o sorteio entrega uma unidade.

Cada máquina tem estoque próprio, compartilhado pelos jogadores. O mestre pode ajustar quantidade e capacidade, usar −1 / +1 / completar, completar todos os estoques, duplicar e reordenar produtos. Uma edição obsoleta não sobrescreve vendas recentes; o rascunho é mantido para recarregar e revisar.

O editor de imagem aceita arquivo, caminho do Foundry e URL de imagem, com zoom pela roda do mouse, arraste, rotação e enquadramento persistente. Páginas com imagem reconhecível podem ser resolvidas quando o navegador permite; links bloqueados precisam de imagem direta ou arquivo. Cancelar não envia nem aplica a edição. As cores do corpo, painel, faixa e detalhes podem ser ajustadas pelo mestre, com prévia antes de salvar.

Catálogos podem ser exportados e importados em JSON. Importar substitui o catálogo do rascunho e exige salvar; o histórico é preservado.

## Sorteio por categoria

Produtos esgotados ou ocultos nunca entram no sorteio. **Doces** usa somente doces; **Todos** inclui todas as categorias disponíveis. A categoria permanece após comprar e, se esgotar, o botão fica indisponível. Repetições são possíveis em um sorteio aleatório; Web Crypto fornece uma nova amostra por pedido.

| Modo | Distribuição |
| --- | --- |
| Chances iguais | Mesma chance por produto disponível. |
| Pesos personalizados | Chance proporcional ao peso; peso zero exclui. |
| Proporcional ao estoque | Chance proporcional às unidades disponíveis. |

## Pagamento e recuperação

Preços de produtos e sorteios são **quantidades inteiras de mana**. O mestre responsável calcula o preço a partir do catálogo real, confere quantidade, categoria, estoque e saldo. Valores enviados pelo jogador não determinam o débito.

O Banco de Mana reserva o valor, e a máquina grava estoque e recibo juntos na região. Em seguida, o banco conclui o débito. Uma compra paga gera **uma mensagem pública do banco**, somente com alteração e valores antes/depois, além do aviso financeiro já existente. Não é enviada uma segunda mensagem de compra. Produtos gratuitos não geram mensagem financeira.

Banco e região são documentos separados. Se a conexão interromper a confirmação, a reserva e o produto escolhido permanecem registrados para recuperação pelo mesmo ID. Isso evita uma nova cobrança ou novo sorteio ao recuperar. A recuperação de compras pendentes precede novos gastos do banco; alterações na máquina ficam bloqueadas enquanto a compra dela está pendente. Mantenha ambos os módulos ativos e um mestre conectado até concluir. Uma validação definitiva anterior à entrega restitui a reserva; falhas ambíguas de gravação são recuperadas.

Pedidos concorrentes passam pela autoridade do banco e pela fila da máquina. Revisões rejeitam pedidos obsoletos; estoque insuficiente, saldo insuficiente ou preço alterado não confirmam a compra. Em um pedido recusado, confira o valor atual e tente novamente.

Cada máquina armazena até 2000 recibos e exibe os últimos 100. **Exportar e arquivar**, exclusivo do mestre, baixa o histórico e libera espaço. Esses dados ficam nas flags da região; a filtragem da interface não torna documentos secretos. Operações administrativas usam mensagens privadas nativas entre mestre solicitante e mestre responsável, sem socketlib. Compras usam o transporte autenticado por documentos User do banco.

## Prévia e desenvolvimento

```bash
npm test
npm run check
python3 docs/build-preview.py
python3 docs/build-release.py
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node docs/test-preview.mjs
node docs/test-manager.mjs
node docs/test-scale-motion.mjs
node docs/test-random-category.mjs
BANK_SOURCE=/caminho/holosuite-mana node docs/test-foundry-integration.mjs
```

Use o código do Banco de Mana **v2.3.0** para a integração; por padrão, o teste procura o diretório irmão `holosuite-mana`. O workflow obtém essa tag antes do teste. `HV_CHROMIUM_PATH` aceita um Chromium instalado.

`Maquina-de-Lanches-Preview.html` e `Gerenciamento-Mestre-Preview.html` demonstram a interface com dados fictícios. São arquivos autocontidos gerados localmente; não alteram o mundo. A integração com saldo real é exercitada pelo teste com três clientes e código dos dois módulos.

Validação: **46 testes Node**, **68 cenários Chromium de interface** e **13 cenários de integração** com três clientes independentes. Inclui desenho nativo, ausência da aba e dos marcadores antigos, duplo clique sem token, pan/zoom, preço adulterado, saldo insuficiente, disputa pela última unidade, falha de gravação, resposta perdida e recuperação de sorteio sem novo débito.

A sessão licenciada de Foundry 13 ainda precisa de validação: canvas/elevação reais, permissões, FilePicker e instalação. O manifesto não declara `verified`. JavaScript ES Modules, ApplicationV2, CSS isolado e APIs nativas, sem compilação para instalar.

## API

```javascript
const vending = game.modules.get('holosuite-vending').api;
await vending.open({regionId: 'ID_DA_REGIAO'});
await vending.openEditor({regionId: 'ID_DA_REGIAO'}); // mestre
vending.drawArea('rectangle'); // mestre
vending.drawArea('polygon');
```

Também existem `getMachine(region)`, `attach(region)`, `createArea(scene,bounds,config)` e `redrawArea(region,tool)`. O serviço registra a integração quando o banco está disponível, inclusive pelo hook `mana-bank.ready`.

## Publicação

[Repositório STR4DZN/maquina-de-lanches](https://github.com/STR4DZN/maquina-de-lanches). O workflow valida e publica tag e release para versões inéditas de `module.json`. O manifesto de atualização usa `releases/latest/download/module.json`; o ZIP é fixo por versão. O pacote contém manifesto, scripts, estilos, licença e documentação, sem testes ou dependências de desenvolvimento.
