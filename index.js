const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});


const VALORES_APOSTA = [100.00, 80.00, 50.00, 30.00, 15.00, 10.00, 5.00, 3.00, 2.00, 1.00, 0.80, 0.50];
const filas = new Map();
const confirmacoes = new Map();

function formatarMoeda(valor) {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!')) return;

  const comando = message.content.toLowerCase();

  // Limpeza segura sem dar crash no Node.js
  if (comando === '!limpar' || comando === '!clear') {
    try {
      await message.delete().catch(() => {});
      const fetched = await message.channel.messages.fetch({ limit: 50 });
      for (const msg of fetched.values()) {
        await msg.delete().catch(() => {});
      }
    } catch (e) {
      console.log("Erro ao limpar mensagens:", e);
    }
    return;
  }

  if (!comando.startsWith('!postar')) return;

  const ehEmu = comando.includes('emu');
  const tipoPlataforma = ehEmu ? 'EMULADOR' : 'MOBILE';
  const tipoModo = comando.replace('!postar', '').replace('emu', '').toUpperCase();

  const modosValidos = ['1X1', '2X2', '3X3', '4X4'];

  if (modosValidos.includes(tipoModo)) {
    await message.delete().catch(() => {});

    for (const valor of VALORES_APOSTA) {
      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${tipoModo} ${tipoPlataforma} | BLEND APOSTAS`)
        .setColor('#2B2D31')
        .setDescription(
          `Clique abaixo para escolher sua modalidade e entrar na fila!\n\n` +
          `💰 **Aposta:**\n` +
          `${formatarMoeda(valor)} (+ R$ 0,20 Taxa ADM)\n\n` +
          `👤 **Jogadores na Fila (0/2):**\n` +
          `Nenhum jogador na fila`
        );

      let botoes = new ActionRowBuilder();

      if (tipoModo === '1X1') {
        botoes.addComponents(
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
        );
      } else {
        botoes.addComponents(
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('SAIR').setStyle(ButtonStyle.Secondary)
        );
      }

      await message.channel.send({ embeds: [embed], components: [botoes] });
    }
  }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    await interaction.deferUpdate().catch(() => {});

    const partes = interaction.customId.split('|');
    if (partes.length < 4) return;

    const [acao, modo, valorStr, opcaoEscolhida] = partes;
    const valor = parseFloat(valorStr);
    const chaveFila = `${interaction.message.id}`;
    const usuarioId = interaction.user.id;

    if (!filas.has(chaveFila)) {
        filas.set(chaveFila, []);
    }
    let listaJogadores = filas.get(chaveFila);

    if (acao === 'entrar') {
        const jaEstaNestaFila = listaJogadores.some(j => j.id === usuarioId);
        if (jaEstaNestaFila) {
            return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true });
        }

        let totalFilasAtivas = 0;
        for (const [outraChave, jogadores] of filas.entries()) {
            if (jogadores.some(j => j.id === usuarioId)) {
                totalFilasAtivas++;
            }
        }

        if (totalFilasAtivas >= 3) {
            return interaction.followUp({ content: '❌ Você atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true });
        }

        listaJogadores.push({ id: usuarioId, opcao: opcaoEscolhida });

        if (listaJogadores.length >= 2) {
            const player1 = listaJogadores[0];
            const player2 = listaJogadores[1];

            filas.set(chaveFila, []);

            await interaction.channel.send({
                content: `🚨 **FILA FECHADA!**\nConfronto: <@${player1.id}> (${player1.opcao}) vs <@${player2.id}> (${player2.opcao})\nValor: R$ ${valor.toFixed(2)}`
            });
        }
    } else if (acao === 'sair') {
        const index = listaJogadores.findIndex(j => j.id === usuarioId);
        if (index !== -1) {
            listaJogadores.splice(index, 1);
        }
    }
});
