const { 
    Client, GatewayIntentBits, ActionRowBuilder, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, 
    TextInputStyle, ButtonBuilder, ButtonStyle, ContainerBuilder,
    TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, 
    MessageFlags, Events, PermissionFlagsBits, ChannelType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

// --- إعدادات البوت ---
const CONFIG = {
    TOKEN: "",
    AUTHORIZED_USER: "411455037416538113", // الشخص المسموح له بعمل setup
    
    // إعدادات الدعم الفني
    TECH: {
        CATEGORY: "1454082788465574012",
        ROLE: "1453538391793729689"
    },
    
    // إعدادات التشهير
    PROMO: {
        CATEGORY: "1454079407135129871",
        ROLE: "1453535370489888922"
    }
};

client.on(Events.ClientReady, () => {
    console.log(`✅ Ticket Bot is Ready! Logged in as ${client.user.tag}`);
});

// --- أمر !t-setup لإنشاء رسالة التكت ---
client.on(Events.MessageCreate, async (message) => {
    if (message.content === '!t-setup') {
        // التحقق من الشخص المسموح له
        if (message.author.id !== CONFIG.AUTHORIZED_USER) return;

        const menu = new StringSelectMenuBuilder()
            .setCustomId('open_ticket_menu')
            .setPlaceholder('Select Ticket Category | اختر قسم التكت')
            .addOptions(
                { label: 'دعم فني', value: 'tech_support', emoji: '🛠️', description: 'فتح تكت للتواصل مع الدعم الفني' },
                { label: 'تشهير', value: 'promo_request', emoji: '📢', description: 'فتح تكت لطلبات التشهير' }
            );

        const setupContainer = new ContainerBuilder()
            .addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🎫 مركز المساعدة والطلبات\nأهلاً بك في نظام التذاكر الخاص بنا. يرجى اختيار القسم المناسب من القائمة بالأسفل ليتم تحويلك للفريق المختص.`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.guild.iconURL())))
            .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

        await message.channel.send({ components: [setupContainer], flags: MessageFlags.IsComponentsV2 });
    }
});

// --- التعامل مع التفاعلات ---
client.on(Events.InteractionCreate, async (interaction) => {

    // 1. فتح التكت عند اختيار نوع من القائمة
    if (interaction.isStringSelectMenu() && interaction.customId === 'open_ticket_menu') {
        const type = interaction.values[0];
        const isSupport = type === 'tech_support';
        const categoryId = isSupport ? CONFIG.TECH.CATEGORY : CONFIG.PROMO.CATEGORY;
        const roleId = isSupport ? CONFIG.TECH.ROLE : CONFIG.PROMO.ROLE;

        const ticketChannel = await interaction.guild.channels.create({
            name: `${isSupport ? 'support' : 'promo'}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
            ],
        });

        const controlMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_actions')
            .setPlaceholder('Ticket Tools | أدوات التحكم')
            .addOptions(
                { label: 'Claim (استلام)', value: 'claim_ticket', emoji: '✅' },
                { label: 'Add Member (إضافة عضو)', value: 'add_member', emoji: '➕' },
                { label: 'Remove Member (إزالة عضو)', value: 'remove_member', emoji: '➖' },
                { label: 'Close (قفل التكت)', value: 'close_ticket', emoji: '🔒' }
            );

        const ticketContainer = new ContainerBuilder()
            .addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🎫 تكت جديدة: ${isSupport ? 'دعم فني' : 'تشهير'}\nمرحباً <@${interaction.user.id}>، يرجى كتابة استفسارك وانتظار الفريق المختص.\n\n**المسؤولين:** <@&${roleId}>`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(interaction.user.displayAvatarURL())))
            .addActionRowComponents(new ActionRowBuilder().addComponents(controlMenu));

        await ticketChannel.send({ 
            content: `||<@${interaction.user.id}> & <@&${roleId}>||`, 
            components: [ticketContainer], 
            flags: MessageFlags.IsComponentsV2 
        });

        await interaction.reply({ content: `✅ تم فتح التكت الخاصة بك: ${ticketChannel}`, flags: MessageFlags.Ephemeral });
    }

    // 2. التحكم في التكت (Select Menu)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_actions') {
        const action = interaction.values[0];
        
        // التحقق إذا كان الشخص من طاقم العمل (المختصين)
        const isStaff = interaction.member.roles.cache.has(CONFIG.TECH.ROLE) || interaction.member.roles.cache.has(CONFIG.PROMO.ROLE);
        if (!isStaff) return interaction.reply({ content: "❌ عذراً، هذه الأدوات مخصصة لطاقم العمل فقط.", flags: MessageFlags.Ephemeral });

        if (action === 'claim_ticket') {
            await interaction.channel.send({ content: `✅ تم استلام التكت بواسطة: <@${interaction.user.id}>` });
            await interaction.reply({ content: "تم تسجيل الاستلام.", flags: MessageFlags.Ephemeral });
        }

        if (action === 'add_member' || action === 'remove_member') {
            const modal = new ModalBuilder()
                .setCustomId(`${action}_modal`)
                .setTitle(action === 'add_member' ? "إضافة عضو للتكت" : "إزالة عضو من التكت");
            
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('user_id').setLabel("ID العضو").setStyle(TextInputStyle.Short).setPlaceholder("أدخل الأيدي هنا...").setRequired(true)
            ));
            await interaction.showModal(modal);
        }

        if (action === 'close_ticket') {
            await interaction.reply("🔒 جاري قفل وحذف التكت خلال 5 ثوانٍ...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }

    // 3. معالجة مودالات الإضافة والإزالة
    if (interaction.isModalSubmit()) {
        const userId = interaction.fields.getTextInputValue('user_id');
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) return interaction.reply({ content: "❌ لم يتم العثور على هذا العضو في السيرفر.", flags: MessageFlags.Ephemeral });

        if (interaction.customId === 'add_member_modal') {
            await interaction.channel.permissionOverwrites.edit(member, { ViewChannel: true, SendMessages: true });
            await interaction.reply({ content: `✅ تم إضافة العضو <@${userId}> للتكت بنجاح.` });
        }

        if (interaction.customId === 'remove_member_modal') {
            await interaction.channel.permissionOverwrites.edit(member, { ViewChannel: false });
            await interaction.reply({ content: `❌ تم إزالة العضو <@${userId}> من التكت.` });
        }
    }
});

client.login(CONFIG.TOKEN);
