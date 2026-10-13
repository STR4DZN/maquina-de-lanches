# Máquina de Lanches — 0.4.1

Módulo para **Foundry VTT 13**. Uma máquina física com vitrine de produtos, teclado de seleção, compartimento de retirada e entrega imediata. O mestre desenha a área diretamente no mapa e configura os produtos em um painel separado. A identidade visual é independente do HoloSuite.

**O pagamento continua adiado.** Os preços são informativos. O módulo não consulta nem altera seu módulo de dinheiro e não cria itens na ficha Lancer. Cada retirada gera um recibo persistente vinculado ao jogador, token e ator; “Pegar” recolhe a entrega visual sem descontar estoque novamente.

## O fluxo no Foundry

1. Abra o mapa como mestre e clique **Demarcar máquina de vendas** nas ferramentas de Tokens ou de Regiões. Também há **Demarcar área** na janela do módulo.
2. O módulo ativa o **polígono nativo das Regiões** e desmarca regiões anteriores. Clique para adicionar os pontos da área e dê duplo clique para finalizar. Se preferir, mude para a ferramenta nativa de **Retângulo** e arraste. Escape cancela a vinculação.
3. Assim que uma nova região sua for criada na mesma cena, o módulo vincula a máquina e abre a configuração. Não é necessário digitar coordenadas.
4. Em **Produtos**, adicione produtos e configure imagem, nome, categoria, descrição, quantidade, capacidade máxima, preço, chance do sorteio e visibilidade. Salve.
5. Em **Aparência e opções**, escolha uma paleta ou personalize corpo, painel, faixa superior e detalhes. A prévia muda imediatamente; salve para aplicar aos jogadores. Em **Área no mapa**, localize, mova, ajuste escala/elevação ou redesenhe a região da mesma máquina, preservando catálogo, estoque e histórico.
6. O jogador move um token que controla para dentro da região. O centro do token, respeitando a elevação, precisa estar dentro da área. O jogador abre a máquina pelo marcador no mapa, botão de loja nas ferramentas de Tokens ou launcher HoloSuite, quando instalado.
7. O jogador seleciona o produto pela vitrine ou pelo código, escolhe a quantidade e clica **Retirar lanche**. O lanche aparece no compartimento após a confirmação; **Pegar** libera o compartimento. **Escolha por mim** sorteia uma unidade entre os produtos disponíveis.

Você também pode selecionar uma região já desenhada e vinculá-la quando a cena ainda não possui máquinas. A API oferece `attach(region)` para regiões existentes e `drawArea("polygon")` ou `drawArea("rectangle")` para iniciar uma demarcação.

## Vitrine e seleção

- A vitrine mostra nove produtos por vez. Produtos adicionais ficam em vitrines paginadas, mantendo seus códigos.
- A1, A2, A3, B1… são determinados pela ordem do catálogo. Há teclado que acompanha a vitrine e 1/2/3 e um campo para códigos de outras fileiras.
- A seleção destaca o produto e mostra nome, código, quantidade disponível e preço no visor.
- Há busca por nome, categoria ou código, filtro por categoria e salto direto à vitrine desejada. Catálogos com até 200 produtos usam no máximo 23 vitrines. O preço não é cobrado nesta versão.
- O editor de imagem aceita arquivos do computador (até 20 MB), caminhos do Foundry, URLs HTTP/HTTPS diretas, links de pesquisa que contenham a imagem e páginas públicas que exponham imagem em metadados e permitam leitura. Sites protegidos, links de mensagens do Discord e páginas com restrições podem exigir link direto ou upload. GIFs permanecem animados.
- Arraste a imagem, use a roda do mouse ou o controle de zoom (25%–600%), gire, escolha imagem inteira/preencher ou remova. O enquadramento proporcional é compartilhado entre catálogo, vitrine e entrega. Cancelar preserva a imagem anterior; o upload acontece somente ao aplicar, e o produto só muda para jogadores depois de salvar.
- As ilustrações padrão são placeholders em SVG para produtos sem imagem. O mestre pode substituí-las por qualquer imagem de produto acessível ao Foundry.
- Produtos desativados não aparecem. Produtos esgotados podem ser vistos, mas não retirados nem sorteados.
- A entrega aparece imediatamente após o estoque e o recibo serem gravados. Retiradas com várias unidades mostram uma pilha estática de até quatro lanches e a quantidade exata. Pegar recolhe imediatamente, sem animação ou novo desconto. Fechar a janela preserva o recibo e a entrega.
- A entrega e o recolhimento não usam animações. A preferência de redução de movimento também reduz os efeitos restantes de seleção e interface. Não há animações contínuas enquanto a máquina está ociosa.
- Temas claro/escuro são individuais; a aparência física da máquina é preservada nos dois.

## Configuração, estoque e histórico

Cada máquina tem estoque independente e compartilhado entre jogadores. **Completar todos os estoques** completa a capacidade dos produtos. Quantidades também podem ser ajustadas diretamente no editor, com atalhos −1, +1 e completar. Há busca no catálogo, duplicação, reordenação e campos para categoria, descrição, preço informativo e peso do sorteio. Há limite de 200 produtos por máquina e máximo por retirada configurável de 1 a 100 unidades. Sorteios liberam uma unidade. Eles usam apenas a categoria selecionada; “Todos” inclui o catálogo inteiro. Esgotar a categoria desativa o botão, sem buscar produtos de outras categorias. A categoria permanece selecionada depois de retirar. A fonte aleatória usa Web Crypto quando disponível, com uma nova amostra por pedido; não existe regra para impedir repetições. Novas máquinas usam chances iguais, e o mestre pode configurar pesos ou chances proporcionais ao estoque. Mana é o nome padrão da moeda; o rótulo antigo cr é convertido na interface e na próxima gravação da máquina.

| Sorteio | Distribuição |
| --- | --- |
| Chances iguais | Cada produto disponível tem a mesma chance. |
| Pesos personalizados | A chance é proporcional ao peso. Peso zero exclui o produto. |
| Proporcional ao estoque | Uma unidade entre todas as unidades disponíveis é sorteada. |

Estoque e recibo são gravados juntos na região em uma única atualização. As solicitações são validadas no cliente do mestre responsável, usando o usuário atribuído pelo Foundry à operação. Retiradas, reposições e edições passam pela mesma fila por máquina. Solicitações duplicadas não retiram a mesma unidade duas vezes.

Uma edição que ficar obsoleta por causa de outra alteração ou retirada não pode sobrescrever o estoque; o rascunho permanece aberto e é possível recarregar os dados. Cancelar a confirmação de descarte mantém o rascunho. Confirmar o descarte retorna aos dados salvos.

Catálogos podem ser exportados/importados em JSON. A importação substitui o catálogo do rascunho, conserva o histórico da máquina e exige salvar.

Cada máquina guarda até 2000 recibos, exibindo os últimos 100. **Exportar e arquivar** baixa o histórico em JSON e limpa os registros da máquina, liberando novas retiradas. Guarde o arquivo exportado. O histórico fica nas flags da região: a filtragem “Minhas retiradas” organiza a interface e não constitui armazenamento secreto contra inspeção dos documentos.

É necessário um mestre conectado e permissão de criar mensagens de chat. Solicitações e confirmações são mensagens privadas entre solicitante e mestre responsável, dispensando socketlib. Se a confirmação não chegar, confira o histórico antes de repetir: não há reenvio automático. Mantenha um mestre estável durante as operações; mudanças de autoridade durante operações em andamento ainda exigem validação em ambiente real.

## Instalar ou atualizar no Windows

1. Feche o Foundry.
2. Baixe `Instalar-Maquina-de-Lanches.ps1` e execute no PowerShell. Se necessário, abra o PowerShell na pasta do arquivo e use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Instalar-Maquina-de-Lanches.ps1
```

3. Selecione a pasta **Data** do Foundry, que contém `modules`, `worlds` e `systems`.
4. O instalador grava os arquivos em `Data/modules/holosuite-vending`. Se já existir uma instalação, primeiro faz uma cópia em `Data/module-backups` e depois atualiza os arquivos. As máquinas e estoques ficam nos dados do mundo e não são alterados pelo instalador.
5. Abra o Foundry 13 e ative **Máquina de Lanches** em Gerenciar módulos.

O instalador é local, sem downloads, sem administrador e sem alterar permanentemente a política do PowerShell. Seu payload foi verificado contra os arquivos-fonte; a execução do PowerShell no Windows ainda precisa de validação real.

Para instalação manual, extraia a pasta `holosuite-vending` do arquivo `maquina-de-lanches-source.tar.gz` para `Data/modules`. O ID técnico original é preservado para manter compatibilidade e dados da primeira versão. HoloSuite Core é opcional e usado apenas para acesso pelo launcher.

## Prévia

Gere as prévias com `python3 docs/build-preview.py`. Abra `Gerenciamento-Mestre-Preview.html` para ver a janela do mestre ou `Maquina-de-Lanches-Preview.html` para a máquina dos jogadores. A prévia é autocontida, usa o motor de estoque e a classe de interface reais, e permite alternar entre mestre/jogador, simular presença na área e conexão do mestre, comprar, sortear, configurar e desenhar uma área em um mapa de exemplo.

O mapa da prévia simula o canvas; no Foundry o módulo utiliza as ferramentas nativas de Regiões. Os dados da prévia ficam apenas no navegador. No cabeçalho, “Testar 200 produtos” ativa um catálogo grande para experimentar quantidades e navegação. Ela não é validação em Foundry real.

## API e desenvolvimento

```javascript
const vending = game.modules.get("holosuite-vending").api;
await vending.open();
await vending.openEditor(); // somente mestre
vending.drawArea("polygon"); // somente mestre, desenho no mapa
vending.drawArea("rectangle");
await vending.open({regionId: "ID_DA_REGIAO"});
```

Também há `getMachine(region)`, `attach(region)` e `createArea(scene,bounds,config)` para uso programático. JavaScript ES Modules, ApplicationV2, CSS isolado. Sem dependências de runtime e sem compilação para instalar.

```bash
npm test
npm run check
python3 docs/build-preview.py
python3 docs/build-deliverables.py
```

Para os testes de interface, instale Playwright (`npm install --no-save playwright`), seu Chromium (`npx playwright install chromium`) e rode `node docs/test-preview.mjs`  , `node docs/test-manager.mjs` e `node docs/test-scale-motion.mjs` e `node docs/test-random-category.mjs`. `HV_CHROMIUM_PATH` permite usar um Chromium já instalado.

## Validação

- **50 testes Node:** catálogo, sorteio, estoque, idempotência, revisão, permissões, origem da identidade, pausa, posição, falhas de persistência/confirmação, demarcação nativa e cancelamento.
- **68 cenários Chromium (29 da máquina, 18 do gerenciamento, 13 de escala e 8 de sorteio):** vitrine sem molas, seleção por clique/código, código inválido, quantidade, entrega sem animação, cliques repetidos, recolher sem novo desconto, sorteio, filtros, edição/conflito, reposição, paginação, temas, fechar durante solicitação, redução de movimento, estoque independente, desenho por pontos/retângulo e cancelamento.
- Os testes de concorrência liberam exatamente uma unidade para 200 tentativas simultâneas no motor e para 100 no serviço com documentos simulados.
- Testes adicionais cobrem enquadramento persistente, links e páginas com imagem, cancelamento durante upload, paletas e HEX, geometria com furos, assinatura de área, gravação atômica de catálogo/área e limpeza do desenho temporário.
- Telas de máquina, produtos, cores, recorte, área e entrega foram inspecionadas visualmente. Sem exceções JavaScript nos cenários testados.

**Pendências reais:** instalação em Foundry 13/Windows, geometrias e elevação do canvas real, FilePicker, marcadores PIXI, chat privado com vários clientes, versão instalada do HoloSuite e desconexão/troca de mestre durante operações. O repositório público é `STR4DZN/maquina-de-lanches`. A instalação pela URL depende dos assets da release, gerados pelo workflow após validação. Não há campo `verified` sem teste real. Integração monetária permanece adiada.

## Publicação no GitHub

Repositório público: [STR4DZN/maquina-de-lanches](https://github.com/STR4DZN/maquina-de-lanches).

Manifesto de instalação/atualização para Foundry 13: `https://github.com/STR4DZN/maquina-de-lanches/releases/latest/download/module.json`. Em Configuração → Módulos → Instalar módulo, cole a URL no campo URL do Manifesto. O download é fixo por versão.

- `module.json` usa manifesto de atualização em `releases/latest/download/module.json` e download fixo da versão em `releases/download/v0.4.1/module.zip`.
- `python3 docs/build-release.py` cria `dist/module.zip`, `dist/module.json`, notas e checksums. O ZIP é o formato usado pelo Foundry para instalação automática.
- O workflow de release roda os testes e publica tag/asset quando `module.json` é enviado à branch `main` com uma versão inédita. Também pode ser iniciado manualmente em Actions. Releases existentes são preservadas.
- Para versões futuras, atualize versão, download e changelog antes de enviar à main. O builder ajusta URLs para o repositório do workflow.
- O pacote instala somente scripts, estilos, manifesto, licença e documentação, sem testes, prévias ou dependências de desenvolvimento.
