const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const filas = new Map();

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!limpar') {
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

    if (!message.content.startsWith('!postar')) return;

    const args = message.content.split(' ');
    if (args.length < 3) {
        return message.reply('Use o formato correto: `!postar [1x1 ou 2x2] [valor]`');
    }

    const tipoModo = args[1];
    const valor = parseFloat(args[2]);

    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
        .setTitle(`${tipoModo.toUpperCase()} | BLAND APOSTAS`)
        .setDescription(`🎮 Modo: ${tipoModo}\n💰 Valor: ${formatarMoeda(valor)}\n\n👥 **Nenhum jogador na fila**`)
        .setColor('#0099ff');

    const botoes = new ActionRowBuilder();

    if (tipoModo === '1x1') {
        botoes.addComponents(
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
        );
    } else {
        botoes.addComponents(
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
        );
    }

    await message.channel.send({ embeds: [embed], components: [botoes] });
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

    } else if (acao === 'sair') {
        const index = listaJogadores.findIndex(j => j.id === usuarioId);
        if (index !== -1) {
            listaJogadores.splice(index, 1);
        } else {
            return interaction.followUp({ content: '❌ Você não está nesta fila!', ephemeral: true });
        }
    }

    // Atualiza o visual da caixinha (Embed) com os nomes atualizados
    let textoJogadores = "👥 **Nenhum jogador na fila**";
    if (listaJogadores.length > 0) {
        textoJogadores = `👥 **Jogadores na Fila (${listaJogadores.length}/2):**\n` + 
            listaJogadores.map(j => `<@${j.id}> | ${j.opcao}`).join('\n');
    }

    const novoEmbed = new EmbedBuilder()
        .setTitle(`${modo.toUpperCase()} | BLAND APOSTAS`)
        .setDescription(`🎮 Modo: ${modo}\n💰 Valor: ${formatarMoeda(valor)}\n\n${textoJogadores}`)
        .setColor('#0099ff');

    await interaction.message.edit({ embeds: [novoEmbed] }).catch(() => {});

    // Se fechar 2 jogadores, cria o canal privado automaticamente
    if (listaJogadores.length >= 2) {
        const player1 = listaJogadores[0];
        const player2 = listaJogadores[1];

        filas.set(chaveFila, []);

        // Reseta o embed visual da fila para vazio após fechar
        const embedVazio = new EmbedBuilder()
            .setTitle(`${modo.toUpperCase()} | BLAND APOSTAS`)
            .setDescription(`🎮 Modo: ${modo}\n💰 Valor: ${formatarMoeda(valor)}\n\n👥 **Nenhum jogador na fila**`)
            .setColor('#0099ff');

        await interaction.message.edit({ embeds: [embedVazio] }).catch(() => {});

        try {
            const guild = interaction.guild;
            
            const canalPrivado = await guild.channels.create({
                name: `sala-${player1.opcao}-${player2.opcao}`.toLowerCase().replace(/\s+/g, '-'),
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: player1.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: player2.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    }
                ]
            });

            await canalPrivado.send({
                content: `🚨 **SALA PRIVADA CRIADA!**\n\nJogadores: <@${player1.id}> (${player1.opcao}) vs <@${player2.id}> (${player2.opcao})\nValor: ${formatarMoeda(valor)}\n\n*Conversem por aqui para acertar a aposta!*`
            });

        } catch (e) {
            console.log("Erro ao criar canal privado:", e);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
