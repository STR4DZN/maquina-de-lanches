Máquina de Lanches 0.5.0 · Foundry VTT 13.

- Área com contorno simples, sem ícone ou nome sobre o mapa.
- Duplo clique na área abre a máquina para jogadores, sem exigir token.
- Remove o grupo/aba próprio de máquinas; criação e configuração ficam nas ferramentas nativas de Regiões.
- Ao desenhar, vincula a máquina e abre o gerenciamento. Shift + duplo clique abre o editor para o mestre.
- Compras descontam do saldo compartilhado do Banco de Mana 2.3.0 ou posterior.
- Preço, estoque, categoria e saldo validados pelo mestre responsável; uma mensagem financeira por compra paga.
- Reserva persistente e recuperação pelo mesmo ID, sem nova cobrança ou novo sorteio após falhas.
- Mantém produtos, estoques, cores, imagens, quantidades, seleção e sorteio por categoria existentes.
- 46 testes Node, 68 cenários de interface e 12 de integração Chromium com três clientes e os dois módulos reais sob contratos simulados.

Atualize também o Banco de Mana para 2.3.0. Ative ambos e recarregue todos os clientes com F5.

Como criar: Regiões → Criar máquina de vendas (retângulo ou polígono) → desenhar → configurar e salvar. O jogador dá duplo clique na área e compra.

Sem dependências obrigatórias no manifesto. Sem banco compatível, a máquina abre com compras bloqueadas. Validação em sessão licenciada real ainda necessária.
