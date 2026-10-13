Máquina de Lanches 0.4.2 para Foundry VTT 13.

- Corrige as janelas que não abriam por conflito com `ApplicationV2.state`, propriedade somente leitura.
- Remove a integração e a dependência opcional do HoloSuite.
- Grupo próprio **Máquinas de vendas** (ícone de loja) nos controles do mapa, separado de Tokens e Regiões.
- Botões para usar, gerenciar, desenhar polígono/retângulo e mostrar/ocultar marcadores.
- Marcadores legíveis com o nome da máquina: clique ou teclado para usar; botão direito do mestre para gerenciar.
- Marcadores acompanham pan/zoom e respeitam a presença do token dos jogadores.
- Ao concluir a demarcação, volta à camada de máquinas e abre a configuração.
- Preserva as máquinas, catálogos, estoques, mana e sorteio por categoria existentes.
- 50 testes Node, 68 cenários de interface e 13 de integração Chromium com o ponto de entrada ES real.

**Após atualizar, recarregue a página com F5** para limpar os registros antigos da sessão. O ID técnico é preservado para manter os dados existentes.

Instalação: use o asset module.json desta release como URL do Manifesto em Instalar Módulo. O manifesto baixa module.zip da mesma versão.

Preços informativos. Testes usam contratos/documentos simulados e Chromium; validação em uma sessão real do Foundry permanece necessária.
