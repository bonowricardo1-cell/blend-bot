const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionsBitField } = require('discord.js')
    const http = require('http');


const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SAMURAI E-SPORTS bot rodando normal e ativo!\n');
});

server.listen(PORT, () => {
    console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const filas = new Map();
const confirmadosPartida = new Map();
const CARGO_SUPORTE_ID = '1541235665960833145';

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!limpar')) {
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

    // Comando para postar o Painel de Tickets
    if (message.content.startsWith('!ticket')) {
        await message.delete().catch(() => {});

        const embedTicket = new EmbedBuilder()
            .setTitle('SAMURAI E-SPORTS | Central de Atendimento 🎫')
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription('📂 Seja bem-vindo(a) ao sistema de atendimento! Aqui você pode abrir um ticket de forma rápida e organizada.\n\n👇 **Selecione uma das opções no menu abaixo para iniciar seu atendimento e aguarde que nossa equipe irá te responder o mais breve possível.**')
            .setColor('#0099ff');

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('criar_ticket')
                .setPlaceholder('Selecione o ticket que deseja abrir')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Suporte')
                        .setDescription('Auxílio, ajudas, dúvidas e propostas...')
                        .setValue('suporte')
                        .setEmoji('💬'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Reembolso')
                        .setDescription('Adm pagou errado, sumiu e precisa de reembolso.')
                        .setValue('reembolso')
                        .setEmoji('💳'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Seja Mediador')
                        .setDescription('Abra ticket aqui para fazer parte da equipe.')
                        .setValue('seja_mediador')
                        .setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Divulgação')
                        .setDescription('Caso queira uma divulgação.')
                        .setValue('divulgacao')
                        .setEmoji('📢')
                )
        );

        await message.channel.send({ embeds: [embedTicket], components: [menuRow] });
        return;
    }

    if (message.content.startsWith('!postar-tudo')) {
        const args = message.content.trim().split(/\s+/);
        if (args.length < 2) {
            return message.reply('Use o formato correto: `!postar-tudo 2.00`');
        }

        const valor = parseFloat(args[1].replace(',', '.'));
        if (isNaN(valor)) {
            return message.reply('❌ Por favor, insira um valor numérico válido, ex: `!postar-tudo 2.00`');
        }

        await message.delete().catch(() => {});
        const taxaAdm = 0.15;

        const canais = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        
        for (const [id, canal] of canais) {
            const nomeCanal = canal.name.toLowerCase();
            
            if (nomeCanal.includes('regra') || nomeCanal.includes('cargo') || nomeCanal.includes('chat') || nomeCanal.includes('aviso')) continue;
            if (!nomeCanal.includes('1x1') && !nomeCanal.includes('2x2') && !nomeCanal.includes('3x3') && !nomeCanal.includes('4x4')) continue;

            let tipoModo = '1x1';
            if (nomeCanal.includes('2x2')) tipoModo = '2x2';
            if (nomeCanal.includes('3x3')) tipoModo = '3x3';
            if (nomeCanal.includes('4x4')) tipoModo = '4x4';

            const embed = new EmbedBuilder()
                .setTitle(`${tipoModo.toUpperCase()} | SAMURAI E-SPORTS`)
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setDescription(`🎮 Modo: ${tipoModo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Nenhum jogador na fila**`)
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

            await canal.send({ embeds: [embed], components: [botoes] }).catch(() => {});
        }
        return;
    }

    if (!message.content.startsWith('!postar')) return;

    const args = message.content.trim().split(/\s+/);
    if (args.length < 3) {
        return message.reply('Use o formato correto com espaço: `!postar 1x1 2.00`');
    }

    const tipoModo = args[1];
    const valor = parseFloat(args[2].replace(',', '.'));

    if (isNaN(valor)) {
        return message.reply('❌ Por favor, insira um valor numérico válido, ex: `!postar 1x1 2.00`');
    }

    await message.delete().catch(() => {});
    const taxaAdm = 0.15;

    const embed = new EmbedBuilder()
        .setTitle(`${tipoModo.toUpperCase()} | SAMURAI E-SPORTS`)
        .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
        .setDescription(`🎮 Modo: ${tipoModo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Nenhum jogador na fila**`)
        .setColor('#0099ff');

    const botoes = new ActionRowBuilder();

    if (tipoModo.toLowerCase().includes('1x1')) {
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
    // Tratamento do Menu Suspenso de Tickets
    if (interaction.isStringSelectMenu() && interaction.customId === 'criar_ticket') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        const tipoTicket = interaction.values[0];
        const guild = interaction.guild;
        const usuario = interaction.user;

        try {
            const canalTicket = await guild.channels.create({
                name: `ticket-${tipoTicket}-${usuario.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: usuario.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                ]
            });

            const embedTicketAberto = new EmbedBuilder()
                .setColor('#0099ff')
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setTitle(`SAMURAI E-SPORTS | Ticket - ${tipoTicket.toUpperCase()}`)
                .setDescription(`Olá <@${usuario.id}>, seu ticket foi aberto com sucesso!\n\nAguarde um momento e nossa equipe de suporte (<@&${CARGO_SUPORTE_ID}>) já irá lhe atender.`);

            const botaoFechar = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fechar_ticket')
                    .setLabel('Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            await canalTicket.send({
                content: `<@${usuario.id}> | <@&${CARGO_SUPORTE_ID}>`,
                embeds: [embedTicketAberto],
                components: [botaoFechar]
            });

            await interaction.followUp({ content: `✅ Seu ticket foi criado com sucesso em: <#${canalTicket.id}>`, ephemeral: true }).catch(() => {});
        } catch (e) {
            console.log("Erro ao criar canal de ticket:", e);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true }).catch(() => {});
        }
        return;
    }

    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }
        await interaction.followUp({ content: '🔒 Este ticket será fechado em 3 segundos...', ephemeral: true }).catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 3000);
        return;
    }

    if (!interaction.isButton()) return;

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }
if (interaction.isButton() && interaction.customId.includes('|')) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }
        
        const partes = interaction.customId.split('|');
        if (partes.length < 4) return;

        const [acao, modo, valorStr, opcaoEscolhida] = partes;
        const valor = parseFloat(valorStr);
        const taxaAdm = 0.15;
        const chaveFila = `${interaction.message.id}`;
        const usuarioId = interaction.user.id;

        if (!filas.has(chaveFila)) {
            filas.set(chaveFila, []);
        }
        let listaJogadores = filas.get(chaveFila);

        if (acao === 'entrar') {
            const jaEstaNestaFila = listaJogadores.some(j => j.id === usuarioId);
            if (jaEstaNestaFila) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true }).catch(() => {});
            }

            let totalFilasAtivas = 0;
            for (const [outraChave, jogadores] of filas.entries()) {
                if (jogadores.some(j => j.id === usuarioId)) {
                    totalFilasAtivas++;
                }
            }

            if (totalFilasAtivas >= 3) {
                return interaction.followUp({ content: '❌ Você atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true }).catch(() => {});
            }

            listaJogadores.push({ id: usuarioId, opcao: opcaoEscolhida });

        } else if (acao === 'sair') {
            const index = listaJogadores.findIndex(j => j.id === usuarioId);
            if (index !== -1) {
                listaJogadores.splice(index, 1);
            } else {
                return interaction.followUp({ content: '❌ Você não está nesta fila!', ephemeral: true }).catch(() => {});
            }
        }

        let textoJogadores = "👥 **Nenhum jogador na fila**";
        if (listaJogadores.length > 0) {
            textoJogadores = `👥 **Jogadores na Fila (${listaJogadores.length}/1):**\n` + 
                listaJogadores.map(j => `<@${j.id}> | ${j.opcao}`).join('\n');
        }

        const novoEmbed = new EmbedBuilder()
            .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n${textoJogadores}`)
            .setColor('#0099ff');

        await interaction.message.edit({ embeds: [novoEmbed] }).catch(() => {});

        if (listaJogadores.length >= 1) {
            const player1 = listaJogadores[0];

            filas.set(chaveFila, []);

            const embedVazio = new EmbedBuilder()
                .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Nenhum jogador na fila**`)
                .setColor('#0099ff');

            await interaction.message.edit({ embeds: [embedVazio] }).catch(() => {});

            try {
                const guild = interaction.guild;
                const admId = interaction.user.id;

                const canalPrivado = await guild.channels.create({
                    name: `sala-${player1.opcao}`.toLowerCase().replace(/\s/g, '-'),
                    type: ChannelType.GuildText,
                    parent: interaction.channel.parentId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: player1.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                    ]
                });

                confirmadosPartida.set(canalPrivado.id, []);

                const numPartida = Math.floor(Math.random() * 900000) + 100000;

                const embedApostaCriada = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                    .setTitle('SAMURAI E-SPORTS | Canal de Aposta ✅')
                    .addFields(
                        { name: 'Partida:', value: `${numPartida}`, inline: false },
                        { name: 'Modo:', value: `${modo.toUpperCase()} - ${player1.opcao}`, inline: false },
                        { name: 'Valor da Aposta:', value: `${formatarMoeda(valor)}`, inline: false },
                        { name: 'Taxa ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                        { name: 'Jogadores:', value: `<@${player1.id}>`, inline: false },
                        { name: 'Mediador:', value: `<@${admId}>`, inline: false }
                    );

                const botoesApostaCriada = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirmar_${player1.id}_${valor}_${admId}`)
                        .setLabel('Confirmar Teste')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancelar_aposta')
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );

                await canalPrivado.send({
                    content: `<@${player1.id}>`,
                    embeds: [embedApostaCriada],
                    components: [botoesApostaCriada]
                });
            } catch (e) {
                console.log("Erro ao criar canal privado:", e);
            }
        }
        return;
    }

    if (interaction.customId === 'cancelar_aposta') {
        await interaction.followUp({ content: '❌ Aposta cancelada.', ephemeral: true }).catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 3000);
        return;
    }

    const partesCustomId = interaction.customId.split('_');
    const acao = partesCustomId[0];

    if (acao === 'confirmar') {
        const p1 = partesCustomId[1];
        const valorAposta = parseFloat(partesCustomId[2]);
        const taxaAdm = 0.15;
        const admId = partesCustomId[3];
        const canalId = interaction.channel.id;

        let listaConfirmados = confirmadosPartida.get(canalId) || [];

        if (listaConfirmados.includes(interaction.user.id)) {
            return interaction.followUp({ content: '⚠️ Você já confirmou esta partida!', ephemeral: true }).catch(() => {});
        }

        listaConfirmados.push(interaction.user.id);
        confirmadosPartida.set(canalId, listaConfirmados);

        const embedPagamento = new EmbedBuilder()
            .setColor('#00FF00')
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setTitle('SAMURAI E-SPORTS | Pagamento Liberado 💳')
            .setDescription('Fluxo de pagamento pronto para o confronto:')
            .addFields(
                { name: 'Valor da Aposta:', value: `${formatarMoeda(valorAposta)}`, inline: false },
                { name: 'Taxa do ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                { name: 'Mediador responsável:', value: `<@${admId}>`, inline: false },
                { name: 'Chave Pix:', value: '`11999999999`', inline: false },
                { name: 'Nome completo:', value: 'Miguel Martins', inline: false }
            );

        await interaction.message.edit({
            content: `🔒 **PARTIDA CONFIRMADA!** <@${p1}>`,
            embeds: [embedPagamento],
            components: []
        }).catch(() => {});
    }
});

// ==========================================
// SISTEMA DE FILAS MISTAS E PAINÉIS DE APOSTA
// ==========================================

const filasMistas = {
    '2x2-misto': { formato: '2x2 Misto (1 Emu / 1 Mobile)', valor: 10.00, maxEmu: 1, maxTotal: 2, emus: [], mobiles: [] },
    '3x3-misto': { formato: '3x3 Misto (2 Emu / 1 Mobile)', valor: 20.00, maxEmu: 2, maxTotal: 3, emus: [], mobiles: [] },
    '4x4-misto': { formato: '4x4 Misto (3 Emu / 1 Mobile)', valor: 50.00, maxEmu: 3, maxTotal: 4, emus: [], mobiles: [] }
};

// Listener para cliques nos botões das filas mistas
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    let chaveFila = interaction.customId.split('_').slice(0, 2).join('_');
    if (!filasMistas[chaveFila]) return;

    const fila = filasMistas[chaveFila];
    const acao = interaction.customId.split('_').pop();
    const usuario = interaction.user;

    if (acao.startsWith('emu')) {
        if (fila.emus.includes(usuario.id) || fila.mobiles.includes(usuario.id)) {
            return interaction.reply({ content: '❌ Você já está em alguma vaga desta fila!', ephemeral: true });
        }

        if (fila.emus.length >= fila.maxEmu) {
            return interaction.reply({ content: '❌ As vagas de Emulador já estão esgotadas neste painel!', ephemeral: true });
        }

        fila.emus.push(usuario.id);
        await interaction.reply({ content: `✅ Vaga de Emulador garantida na fila ${chaveFila}! (${fila.emus.length}/${fila.maxEmu})`, ephemeral: true });

        await atualizarPainelMisto(interaction, chaveFila);
        await verificarEFecharFilaMista(interaction, chaveFila);

    } else if (acao === 'sair') {
        const estavaNosEmu = fila.emus.includes(usuario.id);
        const estavaNosMobile = fila.mobiles.includes(usuario.id);

        if (!estavaNosEmu && !estavaNosMobile) {
            return interaction.reply({ content: '⚠️ Você não está nesta fila.', ephemeral: true });
        }

        fila.emus = fila.emus.filter(id => id !== usuario.id);
        fila.mobiles = fila.mobiles.filter(id => id !== usuario.id);

        await interaction.reply({ content: '🚪 Você saiu da fila com sucesso.', ephemeral: true });
        await atualizarPainelMisto(interaction, chaveFila);
    }
});

const filasMistas = {
    '2x2-misto': { formato: '2x2 Misto (1 Emu / 1 Mobile)', valor: 10.00, maxEmu: 1, maxMobile: 1, maxTotal: 2, emus: [], mobiles: [] },
    '3x3-misto': { formato: '3x3 Misto (2 Emu / 1 Mobile)', valor: 20.00, maxEmu: 2, maxMobile: 1, maxTotal: 3, emus: [], mobiles: [] },
    '4x4-misto': { formato: '4x4 Misto (3 Emu / 1 Mobile)', valor: 50.00, maxEmu: 3, maxMobile: 1, maxTotal: 4, emus: [], mobiles: [] }
};

// Função para atualizar o painel misto em tempo real
async function atualizarPainelMisto(interaction, chaveFila) {
    const fila = filasMistas[chaveFila];
    const mensagem = interaction.message;

    let listaJogadores = '';
    if (fila.emus.length === 0 && fila.mobiles.length === 0) {
        listaJogadores = 'Nenhum jogador na fila...';
    } else {
        const emusText = fila.emus.map((id, index) => `${index + 1}º Emu: <@${id}>`).join('\n');
        const mobilesText = fila.mobiles.map((id, index) => `${index + 1}º Mobile: <@${id}>`).join('\n');
        listaJogadores = [emusText, mobilesText].filter(Boolean).join('\n');
    }

    const embedAtual = mensagem.embeds[0];
    const novoEmbed = EmbedBuilder.from(embedAtual)
        .setFields(
            { name: '🎮 Modo', value: fila.formato, inline: true },
            { name: '💰 Valor', value: `R$${fila.valor.toFixed(2)} (Taxa Adm: 15%)`, inline: true },
            { name: '👥 Jogadores na Fila', value: listaJogadores, inline: false }
        );

    await mensagem.edit({ embeds: [novoEmbed] }).catch(() => {});
}

// Função para verificar se lotou e criar o canal privado da partida
async function verificarEFecharFilaMista(interaction, chaveFila) {
    const fila = filasMistas[chaveFila];
    const totalReal = fila.emus.length + fila.mobiles.length;

    if (totalReal >= fila.maxTotal) {
        const guild = interaction.guild;
        const todosJogadores = [...fila.emus, ...fila.mobiles];

        try {
            const categoriaDestino = guild.channels.cache.find(c => c.name.toLowerCase().includes('área adm') || c.name.toLowerCase().includes('misto') || c.type === ChannelType.GuildCategory);

            const canalPrivado = await guild.channels.create({
                name: `⛩️-partida-${chaveFila}-${Math.floor(Math.random() * 900 + 100)}`,
                type: ChannelType.GuildText,
                parent: categoriaDestino ? categoriaDestino.id : null,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    ...todosJogadores.map(id => ({
                        id: id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }))
                ]
            });

            await canalPrivado.send({ content: `🎉 **Fila lotada!** Partida iniciada entre: ${todosJogadores.map(id => `<@${id}>`).join(', ')}` });
            
            // Reseta a fila após fechar
            fila.emus = [];
            fila.mobiles = [];
            
            await interaction.message.delete().catch(() => {});

        } catch (err) {
            console.error('Erro ao criar canal privado da partida:', err);
        }
    }
}

// Listener para cliques nos botões das filas mistas
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    let chaveFila = interaction.customId.split('_')[0];
    if (!filasMistas[chaveFila]) return;

    const fila = filasMistas[chaveFila];
    const partes = interaction.customId.split('_');
    const acao = partes[1]; // 'emu', 'mobile' ou 'sair'
    const usuario = interaction.user;

    if (acao === 'emu') {
        if (fila.emus.includes(usuario.id) || fila.mobiles.includes(usuario.id)) {
            return interaction.reply({ content: '❌ Você já está em alguma vaga desta fila!', ephemeral: true });
        }
        if (fila.emus.length >= fila.maxEmu) {
            return interaction.reply({ content: '❌ As vagas de Emulador já estão esgotadas neste painel!', ephemeral: true });
        }

        fila.emus.push(usuario.id);
        await interaction.reply({ content: `✅ Vaga de Emulador garantida! (${fila.emus.length}/${fila.maxEmu})`, ephemeral: true });

        await atualizarPainelMisto(interaction, chaveFila);
        await verificarEFecharFilaMista(interaction, chaveFila);

    } else if (acao === 'mobile') {
        if (fila.emus.includes(usuario.id) || fila.mobiles.includes(usuario.id)) {
            return interaction.reply({ content: '❌ Você já está em alguma vaga desta fila!', ephemeral: true });
        }
        if (fila.mobiles.length >= fila.maxMobile) {
            return interaction.reply({ content: '❌ As vagas de Mobile já estão esgotadas neste painel!', ephemeral: true });
        }

        fila.mobiles.push(usuario.id);
        await interaction.reply({ content: `✅ Vaga de Mobile garantida! (${fila.mobiles.length}/${fila.maxMobile})`, ephemeral: true });

        await atualizarPainelMisto(interaction, chaveFila);
        await verificarEFecharFilaMista(interaction, chaveFila);

    } else if (acao === 'sair') {
        const estavaNosEmu = fila.emus.includes(usuario.id);
        const estavaNosMobile = fila.mobiles.includes(usuario.id);

        if (!estavaNosEmu && !estavaNosMobile) {
            return interaction.reply({ content: '⚠️ Você não está nesta fila.', ephemeral: true });
        }

        fila.emus = fila.emus.filter(id => id !== usuario.id);
        fila.mobiles = fila.mobiles.filter(id => id !== usuario.id);

        await interaction.reply({ content: '🚪 Você saiu da fila com sucesso.', ephemeral: true });
        await atualizarPainelMisto(interaction, chaveFila);
    }
});

// Comando para enviar o painel misto: !painel 2x2-misto
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!painel')) {
        const argumentos = message.content.split(' ');
        const tipo = argumentos[1];

        if (!filasMistas[tipo]) {
            return message.reply('❌ Tipo inválido. Use: `!painel 2x2-misto`, `!painel 3x3-misto` ou `!painel 4x4-misto`.');
        }

        const configuracao = filasMistas[tipo];

        const embedPainel = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('⚡ CENTRAL DE APOSTAS - FILA MISTA')
            .setDescription('Clique nos botões abaixo para garantir sua vaga de Emulador ou Mobile.')
            .addFields(
                { name: '🎮 Modo', value: configuracao.formato, inline: true },
                { name: '💰 Valor', value: `R$${configuracao.valor.toFixed(2)} (Taxa Adm: 15%)`, inline: true },
                { name: '👥 Jogadores na Fila', value: 'Nenhum jogador na fila...', inline: false }
            );

        const linha = new ActionRowBuilder();

        // Botões de Emulador
        for (let i = 1; i <= configuracao.maxEmu; i++) {
            linha.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${tipo}_emu_${i}`)
                    .setLabel(`${i}º Emu`)
                    .setStyle(ButtonStyle.Success)
            );
        }

        // Botões de Mobile
        for (let i = 1; i <= configuracao.maxMobile; i++) {
            linha.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${tipo}_mobile_${i}`)
                    .setLabel(`${i}º Mobile`)
                    .setStyle(ButtonStyle.Primary)
            );
        }

        // Botão de Sair
        linha.addComponents(
            new ButtonBuilder()
                .setCustomId(`${tipo}_sair`)
                .setLabel('Sair da fila')
                .setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({ embeds: [embedPainel], components: [linha] });
        await message.delete().catch(() => {});
    }
});
