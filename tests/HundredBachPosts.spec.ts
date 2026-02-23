import { test, expect, chromium } from '@playwright/test';

test.describe('Blog Setup and Bach Posts', () => {
    let page;

    async function closeSidebarOverlayIfPresent() {
        const overlay = page.locator('[aria-label="close_sidebar"]');
        if (await overlay.isVisible()) {
            await overlay.click();
            await expect(overlay).toBeHidden();
        }
    }

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await page.goto('http://localhost:5183'); 
    });

    test.describe('Bach Blog with 100 Posts', () => {
        test('Create comprehensive Bach blog with 100 posts', async () => {
            test.setTimeout(15 * 60 * 1000);

            // Configure blog settings
            await page.getByTestId('settings-header').click();
            await closeSidebarOverlayIfPresent();
            await page.getByTestId('blog-settings-accordion').click();
            await page.getByTestId('blog-name-input').fill('The Complete Bach Chronicle');
            await page.getByTestId('blog-description-input').fill('A comprehensive exploration of J.S. Bach\'s life, works, and lasting influence');

            // Add categories
            await page.getByTestId('categories').click();

            // Remove existing categories
            while (await page.getByTestId(/^remove-category-button-/).count() > 0) {
                const removeButton = await page.getByTestId(/^remove-category-button-/).first();
                await removeButton.click();
            }

            const categories = [
                'Sacred Works',
                'Keyboard Works',
                'Orchestral Works',
                'Chamber Music',
                'Teaching Works',
                'Biography',
                'Performance Practice',
                'Musical Analysis',
                'Historical Context',
                'Legacy & Influence'
            ];

            // Add new categories
            for (const category of categories) {
                await page.getByTestId('new-category-input').fill(category);
                await page.getByTestId('add-category-button').click();
            }

            // Create 100 posts about Bach
            const bachPosts = [
                // SACRED WORKS (15 posts)
                {
                    title: "St. Matthew Passion (BWV 244): The Greatest Story Ever Told",
                    content: "Bach's monumental St. Matthew Passion stands as perhaps the most ambitious musical work ever composed. Written for double orchestra, double choir, and soloists, this masterpiece from 1727 represents Bach's profound ability to combine drama, spirituality, and musical complexity. The opening chorus 'Kommt, ihr Töchter' with its celestial soprano ripieno floating above the dramatic dialogue between the two choirs, sets the stage for nearly three hours of extraordinary music that follows.\n\nThe work's architectural planning is astounding: 68 movements that perfectly balance contemplation and drama, using harmonies that paint every shade of human emotion from deepest grief to transcendent joy.",
                    category: "Sacred Works"
                },
                {
                    title: "Mass in B Minor (BWV 232): Bach's Universal Statement of Faith",
                    content: "The B Minor Mass represents Bach's lifetime of musical achievement distilled into a single work. Completed near the end of his life, this Catholic mass written by a Lutheran composer transcends religious boundaries to become a universal statement of faith. The 'Kyrie' alone contains writing of such complexity and emotional depth that it could stand as a masterpiece in its own right.\n\nParticularly moving is the 'Crucifixus', built over a chromatic ground bass that descends like tears, creating a profound expression of sorrow that resolves into the triumphant 'Et Resurrexit' - a musical representation of death and resurrection that remains unmatched in western music.",
                    category: "Sacred Works"
                },
                {
                    title: "Christmas Oratorio (BWV 248): Bach's Festive Celebration",
                    content: "Written for the Christmas season of 1734-35, Bach's Christmas Oratorio is actually six separate cantatas designed to be performed on major feast days during the twelve days of Christmas. The opening chorus 'Jauchzet, frohlocket' with its brilliant trumpets and timpani immediately establishes a mood of jubilation that characterizes this joyous work.\n\nBach's genius for recycling his own material reaches new heights here - many movements are based on secular cantatas, yet their new sacred context feels entirely natural. The tender lullaby 'Schlafe, mein Liebster' and the pastoral sinfonia that opens Part II perfectly capture the wonder of the Christmas story.",
                    category: "Sacred Works"
                },
                {
                    title: "Magnificat in D Major (BWV 243): Baroque Brilliance",
                    content: "Bach's setting of the Magnificat text is a concentrated burst of pure musical joy. Originally composed in E-flat major for Christmas 1723, Bach later revised it to D major, making it even more brilliant and festive. The work showcases Bach's mastery of every Baroque style - from intimate arias to grand choruses with full orchestral forces.\n\nThe 'Gloria Patri' finale is particularly stunning, bringing back the opening material in a perfect architectural circle that symbolizes the eternal nature of divine glory. Each of the twelve movements is a perfectly crafted miniature, together creating a work of remarkable unity and power.",
                    category: "Sacred Works"
                },
                {
                    title: "Cantata BWV 82 'Ich habe genug': The Perfect Sacred Cantata",
                    content: "This intimate cantata for solo bass, oboe, and strings represents Bach at his most personally expressive. Written for the Feast of the Purification in 1727, its theme of peaceful acceptance of death resonated so deeply with Bach that he arranged it multiple times, including a version for soprano.\n\nThe central aria 'Schlummert ein' is one of Bach's most beautiful creations - a gentle lullaby that paints a picture of peaceful death as falling asleep in God's arms. The obbligato oboe throughout the work seems to represent a divine presence, weaving a thread of comfort through the entire cantata.",
                    category: "Sacred Works"
                },
                {
                    title: "Cantata BWV 140 'Wachet auf': The King of Chorales",
                    content: "Known in English as 'Sleepers Wake', this cantata from 1731 demonstrates Bach's mastery of the chorale cantata form. The famous central movement, with the chorale melody in the tenors accompanied by an enchanting orchestral texture, inspired Mendelssohn to call Bach the greatest musical poet of all time.\n\nThe opening chorus is a masterpiece of musical architecture, combining three distinct musical ideas: the dotted rhythms of a French overture, the flowing lines of the chorale melody, and a dance-like countersubject. The result is both mathematically perfect and deeply expressive.",
                    category: "Sacred Works"
                },
                {
                    title: "St. John Passion (BWV 245): Drama in Sacred Music",
                    content: "While often overshadowed by the St. Matthew Passion, Bach's St. John Passion is a more concentrated, dramatically intense work. First performed in 1724, it presents the Passion story with an almost operatic immediacy. The turbae (crowd) choruses are particularly striking, with their violent outbursts representing the mob calling for Christ's crucifixion.\n\nThe aria 'Es ist vollbracht' is one of Bach's most profound moments - a meditation on Christ's death featuring a lone viola da gamba whose dark timbre perfectly captures the solemnity of the moment.",
                    category: "Sacred Works"
                },
                {
                    title: "Motet 'Jesu, meine Freude' (BWV 227): Symmetrical Perfection",
                    content: "This motet, the longest and most complex of Bach's six surviving motets, is a masterpiece of symmetrical construction. Built around verses of the chorale 'Jesu, meine Freude' alternating with texts from Romans 8, its eleven movements form a perfect palindrome in both structure and symbolism.\n\nThe central fugue 'Ihr aber seid nicht fleischlich' represents the core theological message, while the outer movements create a frame of personal devotion. The work demonstrates Bach's ability to combine mathematical precision with deep emotional expression.",
                    category: "Sacred Works"
                },
                {
                    title: "Easter Oratorio (BWV 249): From Secular to Sacred",
                    content: "Originally composed as a secular cantata and later transformed into an Easter celebration, this work demonstrates Bach's genius for adaptation. The opening Sinfonia, with its brilliant trumpet fanfares, sets a tone of jubilation that carries through the entire work.\n\nParticularly beautiful is the aria 'Seele, deine Spezereien', where flute and soprano create a dialogue of exceptional tenderness. The work's origins as a secular piece give it a unique character among Bach's sacred works - more openly joyful and less weighted with theological complexity.",
                    category: "Sacred Works"
                },
                {
                    title: "Cantata BWV 4 'Christ lag in Todesbanden': Early Bach Mastery",
                    content: "One of Bach's earliest surviving cantatas, this work shows the young composer already in full command of his powers. Each verse of Luther's Easter hymn is treated to increasingly complex variations, creating a set of chorale variations for chorus and orchestra.\n\nThe central fourth verse, marking the middle of the seven movements, presents the chorale melody in the soprano against a complex contrapuntal accompaniment - a technique Bach would continue to develop throughout his life. The work's symmetrical structure and intense focus on a single chorale make it unique among Bach's cantatas.",
                    category: "Sacred Works"
                },
                {
                    title: "Cantata BWV 147 'Herz und Mund und Tat und Leben': Beyond 'Jesu, Joy'",
                    content: "While famous for its concluding chorale (known in English as 'Jesu, Joy of Man's Desiring'), this cantata is a masterpiece throughout. The opening chorus, with its brilliant trumpet part and complex vocal writing, is one of Bach's most exciting cantata beginnings.\n\nThe work exists in two versions, originally composed for Advent in Weimar and later expanded for the Feast of the Visitation in Leipzig. The famous chorale setting appears twice, concluding each part with its serene melody floating above a gently rocking orchestral accompaniment.",
                    category: "Sacred Works"
                },
                {
                    title: "Ascension Oratorio (BWV 11): Heavenly Trumpets",
                    content: "This compact oratorio, composed for Ascension Day 1735, demonstrates Bach's ability to create dramatic sacred music on a smaller scale than the great Passions. The opening chorus, with its ascending musical figures depicting Christ's rise to heaven, is particularly effective.\n\nThe central aria 'Ach, bleibe doch' represents the disciples' sorrow at Christ's departure, while the final chorale builds to a magnificent conclusion with full orchestra. The work's brevity makes it a perfect introduction to Bach's larger-scale sacred works.",
                    category: "Sacred Works"
                },
                {
                    title: "Cantata BWV 106 'Gottes Zeit ist die allerbeste Zeit': Young Bach's Funeral Music",
                    content: "Known as the 'Actus Tragicus', this early cantata shows Bach's precocious mastery of expressive sacred music. Written when he was only about 22, the work displays remarkable maturity in its treatment of death and eternity.\n\nThe instrumental introduction, scored for the archaic combination of two recorders and two violas da gamba, creates a timeless atmosphere that sets the stage for one of Bach's most profound meditations on mortality. The central section's interweaving of chorale melodies with biblical texts demonstrates sophisticated theological understanding as well as musical mastery.",
                    category: "Sacred Works"
                },
                {
                    title: "Cantata BWV 80 'Ein feste Burg ist unser Gott': Luther's Hymn Transformed",
                    content: "Based on Luther's famous hymn, this cantata represents Bach's most magnificent treatment of this 'battle hymn of the Reformation'. The opening chorus is a tour de force of counterpoint, with the chorale melody appearing in long notes in the trumpet while the other voices engage in complex imitative writing.\n\nEach movement finds a different way to treat the chorale melody, from simple four-part settings to elaborate arias where the melody becomes almost hidden in the texture. The work demonstrates Bach's complete mastery of the chorale cantata form he developed in his Leipzig years.",
                    category: "Sacred Works"
                },
                {
                    title: "Cantata BWV 78 'Jesu, der du meine Seele': The Perfect Duet",
                    content: "This cantata is famous for containing what many consider Bach's most perfect duet - 'Wir eilen mit schwachen, doch emsigen Schritten'. The movement's walking bass and interweaving voices create a musical picture of souls hastening toward divine help.\n\nThe opening chorus is equally magnificent, based on a chromatic ground bass that creates a deeply emotional setting of the chorale melody. The work demonstrates Bach's ability to combine technical mastery with immediate emotional appeal.",
                    category: "Sacred Works"
                },

                // KEYBOARD WORKS (15 posts)
                {
                    title: "The Well-Tempered Clavier Book I (BWV 846-869): The Old Testament of Piano Music",
                    content: "Composed in 1722, Book I of the Well-Tempered Clavier represents Bach's exploration of all 24 major and minor keys - a radical concept at the time. The famous C Major Prelude opens the collection with deceptive simplicity, while the following fugue demonstrates perfect contrapuntal writing.\n\nEach prelude and fugue pair has its own character: the chromatic intensity of C# minor, the pastoral quality of E Major, the tragic weight of B minor. Together they form what Hans von Bülow called 'The Old Testament' of piano literature.",
                    category: "Keyboard Works"
                },
                {
                    title: "Goldberg Variations (BWV 988): The Summit of Variation Form",
                    content: "Originally written for a Russian count who suffered from insomnia, the Goldberg Variations represent the pinnacle of Baroque variation form. The work begins and ends with an aria of profound simplicity, while the thirty variations between explore every aspect of Baroque keyboard technique.\n\nEvery third variation is a canon, starting at the unison and working up to a canon at the ninth. The final variation, the 'Quodlibet', combines several folk tunes with the work's bass line before the peaceful return of the aria. Glenn Gould's 1955 recording brought this work to worldwide attention, but its depths continue to reward exploration.",
                    category: "Keyboard Works"
                },
                {
                    title: "The Well-Tempered Clavier Book II (BWV 870-893): The New Testament",
                    content: "Composed twenty years after Book I, the second book of the Well-Tempered Clavier shows Bach's style at its most mature and sophisticated. The preludes are more developed, often taking on characteristics of free fantasias or three-part inventions.\n\nThe fugues show even greater mastery, with subjects that seem to anticipate Romantic-era chromaticism. The B-flat minor fugue, with its five voices and expressive subject, represents one of Bach's greatest achievements in the form. Together with Book I, these pieces formed the foundation of keyboard education for generations of musicians.",
                    category: "Keyboard Works"
                },
                {
                    title: "Chromatic Fantasia and Fugue (BWV 903): Baroque Drama",
                    content: "This extraordinary work represents Bach at his most dramatically free and harmonically adventurous. The Fantasia begins with virtuosic scales and arpeggios before moving into a highly chromatic recitative section that pushes the boundaries of 18th-century harmony.\n\nThe following three-voice fugue, with its chromatic subject, maintains the dramatic intensity while demonstrating Bach's contrapuntal mastery. This work influenced generations of composers, from Mozart to Liszt, who admired its combination of free fantasy and strict counterpoint.",
                    category: "Keyboard Works"
                },
                {
                    title: "Italian Concerto (BWV 971): Orchestra for Two Hands",
                    content: "Published in 1735 as part of Clavier-Übung II, the Italian Concerto is Bach's brilliant adaptation of Italian concerto form for solo harpsichord. The outer movements capture the dynamic contrast between tutti and solo sections through careful use of the harpsichord's two manuals.\n\nThe slow movement features one of Bach's most beautiful melodies, accompanied by a pulsing bass that suggests orchestral strings. The final movement is a tour de force of keyboard writing that brings the work to a brilliant conclusion.",
                    category: "Keyboard Works"
                },
                {
                    title: "Six Partitas (BWV 825-830): The Pinnacle of the Dance Suite",
                    content: "Published as Clavier-Übung I between 1726 and 1731, these six suites represent Bach's most sophisticated treatment of dance forms. Each begins with a different type of movement (Praeludium, Sinfonia, Fantasia, etc.) before moving through the standard dance movements.\n\nThe B-flat Partita's Gigue, with its complex invertible counterpoint, and the E minor Partita's Toccata, with its dramatic contrasts, show Bach pushing the boundaries of what was possible in keyboard music.",
                    category: "Keyboard Works"
                },
                {
                    title: "French Suites (BWV 812-817): Elegant Simplicity",
                    content: "Despite their name (which wasn't given by Bach), these suites show Bach at his most intimately expressive. Written while in Cöthen, they demonstrate a perfect balance between melodic grace and contrapuntal sophistication.\n\nThe G major Suite's Sarabande represents Bach at his most tenderly expressive, while the E major Suite's Gigue shows his ability to combine French and Italian styles. These works are perfect examples of Bach's ability to infuse dance forms with profound musical content.",
                    category: "Keyboard Works"
                },
                {
                    title: "English Suites (BWV 806-811): French Style, English Name",
                    content: "Bach's earliest keyboard suites (despite their name) show him absorbing French and Italian influences into his own style. Each begins with a substantial prelude, followed by the traditional dance movements. The A major Suite's Prelude, with its concerto-like structure, and the G minor Suite's Sarabande, with its elaborate ornamentation, are particular highlights.\n\nThese works demonstrate Bach's complete mastery of international Baroque styles while maintaining his own distinctive voice.",
                    category: "Keyboard Works"
                },
                {
                    title: "Toccatas (BWV 910-916): Youthful Virtuosity",
                    content: "These seven works, composed during Bach's early years, show him experimenting with the free toccata style inherited from Buxtehude. Each combines improvisatory passages with strict fugal sections in innovative ways.\n\nThe D minor Toccata (BWV 913), with its dramatic opening and complex fugues, and the G major Toccata (BWV 916), with its brilliant final fugue, show the young Bach already pushing the boundaries of keyboard writing.",
                    category: "Keyboard Works"
                },
                {
                    title: "Two and Three-Part Inventions (BWV 772-801): The Perfect Teaching Pieces",
                    content: "Written for his eldest son Wilhelm Friedemann, these pieces represent Bach's genius for combining pedagogical purpose with musical excellence. The Two-Part Inventions teach perfect independence of hands while the Three-Part Inventions (Sinfonias) introduce the complexity of three-voice texture.\n\nEach piece focuses on a particular technical or musical challenge while maintaining genuine musical interest. The F major Three-Part Invention, with its singing melody, and the E minor Two-Part Invention, with its dramatic character, are particular highlights.",
                    category: "Keyboard Works"
                },
                {
                    title: "Overture in the French Style (BWV 831): Bach's French Connection",
                    content: "Published alongside the Italian Concerto in Clavier-Übung II, this grand suite shows Bach's complete mastery of French Baroque style. The opening Overture, with its majestic dotted rhythms and quick fugal section, sets the stage for a sequence of perfectly crafted dance movements.\n\nThe Echo movement, requiring subtle use of the harpsichord's two manuals, and the final Gigue demonstrate Bach's ability to combine French style with his own contrapuntal mastery.",
                    category: "Keyboard Works"
                },
                {
                    title: "Four Duets (BWV 802-805): Mysterious Masterpieces",
                    content: "Published in Clavier-Übung III, these enigmatic two-voice works show Bach's contrapuntal writing at its most sophisticated. Each explores a different aspect of two-part writing, from the singing lines of the E minor Duet to the complex rhythmic interplay of the F major.\n\nTheir purpose remains debated - they appear in a collection mainly of organ works - but their musical quality is beyond question. They demonstrate Bach's ability to create complete musical statements with just two voices.",
                    category: "Keyboard Works"
                },
                {
                    title: "Aria variata alla maniera italiana (BWV 989): Early Variations",
                    content: "This early set of variations shows Bach experimenting with the variation form he would later perfect in the Goldberg Variations. The theme, in A minor, is followed by ten variations that explore different aspects of Italian keyboard style.\n\nParticularly interesting is how Bach varies both the melody and the bass line throughout the work, creating complex interplay between the voices. The work provides fascinating insights into Bach's development as a composer.",
                    category: "Keyboard Works"
                },
                {
                    title: "Capriccio on the Departure of a Beloved Brother (BWV 992): Programmatic Bach",
                    content: "One of Bach's few programmatic works, this early composition tells the story of a friend's departure through six movements. From the friends' attempt to dissuade the traveler, through a lament, to the final fugue representing the post horn, Bach creates vivid musical pictures.\n\nThe work shows Bach's early mastery of different styles and his ability to combine descriptive elements with solid musical structure. The final fugue on the post horn theme is particularly effective.",
                    category: "Keyboard Works"
                },
                {
                    title: "Fantasy and Fugue in A minor (BWV 944): Youthful Fire",
                    content: "This early work shows Bach experimenting with dramatic contrast and virtuosic writing. The Fantasy opens with brilliant scales and arpeggios before moving into more contrapuntal textures. The following Fugue, with its driving rhythm and clear structure, shows Bach's early mastery of the form.\n\nThe work demonstrates how even in his youth, Bach could combine virtuosic display with solid musical architecture. The final measures of the Fugue, with their dramatic scales, create a particularly effective conclusion.",
                    category: "Keyboard Works"
                },

                // ORCHESTRAL WORKS (12 posts)
                {
                    title: "Brandenburg Concertos (BWV 1046-1051): The Perfect Six",
                    content: "Presented to the Margrave of Brandenburg in 1721, these six concertos represent the pinnacle of Baroque orchestral writing. Each features a different combination of solo instruments, from the brilliant trumpets of No. 2 to the intimate harpsichord solo of No. 5.\n\nThe First Concerto's hunting horns, the Third's string texture, the Fourth's virtuosic violin writing, the Fifth's groundbreaking harpsichord cadenza, and the Sixth's dark viola da gamba sonorities each create a unique sound world. Together they represent Bach's complete mastery of the concerto grosso form.",
                    category: "Orchestral Works"
                },
                {
                    title: "Orchestral Suites (BWV 1066-1069): French Style, German Master",
                    content: "Bach's four orchestral suites combine French dance forms with his own contrapuntal mastery. The Second Suite's famous Badinerie for solo flute, the Third Suite's beloved Air (often called 'Air on the G String'), and the Fourth Suite's majestic Overture demonstrate Bach's orchestral genius.\n\nParticularly impressive is how Bach maintains clear textures even with full Baroque orchestra, creating perfect balance between the different instrumental groups. The trumpet writing in the Third and Fourth Suites is especially brilliant.",
                    category: "Orchestral Works"
                },
                {
                    title: "Violin Concerto in E Major (BWV 1042): Perfect Proportions",
                    content: "This concerto represents Bach's perfect handling of Italian concerto form. The first movement's ritornello structure, the slow movement's singing melody over walking bass, and the final movement's dance-like character create a perfectly balanced whole.\n\nThe slow movement in particular, with its violin melody floating over pizzicato strings, shows Bach's gift for pure melodic beauty. The work influenced many later composers, including Mozart in his violin concertos.",
                    category: "Orchestral Works"
                },
                {
                    title: "Double Violin Concerto in D minor (BWV 1043): Dialog in Music",
                    content: "Bach's concerto for two violins creates a perfect dialogue between the soloists. The outer movements feature complex interplay between the violins, while the slow movement creates one of Bach's most beautiful musical conversations.\n\nThe second movement's interweaving of the solo lines creates a texture of extraordinary beauty, while the finale's driving rhythm and complex counterpoint bring the work to an exciting conclusion. The work demonstrates Bach's complete understanding of violin technique and musical dialog.",
                    category: "Orchestral Works"
                },
                {
                    title: "Harpsichord Concerto in D minor (BWV 1052): Keyboard Drama",
                    content: "Probably arranged from a lost violin concerto, this work represents Bach's most dramatic keyboard concerto. The first movement's powerful unison opening, the slow movement's expressive dialogue between soloist and orchestra, and the final movement's driving rhythm create a work of extraordinary intensity.\n\nThe solo writing pushes the boundaries of what was possible on the harpsichord, creating effects that seem to anticipate the piano concertos of the Classical era. The work's popularity in Bach's time is demonstrated by the multiple copies that survive.",
                    category: "Orchestral Works"
                },
                {
                    title: "Triple Concerto in A minor (BWV 1044): Complex Conversations",
                    content: "This concerto for flute, violin, and harpsichord represents Bach's most complex handling of multiple soloists. Based partially on earlier keyboard works, the concerto creates fascinating dialogues between the three solo instruments.\n\nThe slow movement, with its intimate chamber music texture, and the final movement's fugal interplay between the soloists demonstrate Bach's ability to handle complex textures while maintaining clarity and musical interest.",
                    category: "Orchestral Works"
                },
                {
                    title: "Violin Concerto in A minor (BWV 1041): Italian Influence",
                    content: "This concerto shows Bach's complete assimilation of the Italian concerto style. The first movement's dramatic minor key writing, the slow movement's siciliano rhythm, and the final movement's perpetual motion demonstrate Bach's mastery of Italian musical forms.\n\nThe work's perfect balance between solo and tutti sections, and its idiomatic violin writing, make it a cornerstone of the Baroque violin repertoire. The final movement's driving rhythm creates an especially exciting conclusion.",
                    category: "Orchestral Works"
                },
                {
                    title: "Harpsichord Concerto in F minor (BWV 1056): Elegant Simplicity",
                    content: "This concerto, probably arranged from a lost violin or oboe concerto, is remarkable for its concentrated expression. The famous slow movement, later arranged as the Largo from the keyboard concerto in F minor, creates a moment of extraordinary beauty.\n\nThe outer movements, with their clear textures and strong rhythms, frame this expressive center perfectly. The work demonstrates Bach's ability to create maximum effect with minimal means.",
                    category: "Orchestral Works"
                },
                {
                    title: "Brandenburg Concerto No. 5 (BWV 1050): The First Piano Concerto",
                    content: "The Fifth Brandenburg Concerto deserves special attention as the first real harpsichord concerto. Its extended cadenza in the first movement, where the harpsichord emerges from its traditional continuo role to dominate the texture, was revolutionary for its time.\n\nThe intimate trio texture of the slow movement and the fugal finale demonstrate Bach's complete mastery of both concerto and chamber music styles. This work pointed the way toward the Classical piano concerto.",
                    category: "Orchestral Works"
                },
                {
                    title: "Concerto for Four Harpsichords (BWV 1065): Vivaldi Transformed",
                    content: "Bach's arrangement of Vivaldi's Concerto for Four Violins demonstrates his ability to transform other composers' works. The harpsichord writing adds new layers of complexity to Vivaldi's original, while maintaining its essential energy and drive.\n\nThe interaction between the four soloists creates fascinating textures, while the orchestral accompaniment provides perfect support. The work shows Bach's deep understanding of both Italian style and keyboard technique.",
                    category: "Orchestral Works"
                },
                {
                    title: "Harpsichord Concerto in E Major (BWV 1053): From Sacred to Secular",
                    content: "This concerto, arranged from movements of Bach's cantatas, demonstrates his skill in transforming vocal music into instrumental works. The slow movement, originally an aria, becomes a beautiful song without words when played on the harpsichord.\n\nThe outer movements' brilliant figuration and strong rhythms show Bach's ability to create effective concert music from diverse sources. The work demonstrates the fluid boundaries between sacred and secular music in Bach's output.",
                    category: "Orchestral Works"
                },
                {
                    title: "Sinfonia in F Major (BWV 1046a): Brandenburg Before Brandenburg",
                    content: "This early version of what would become the First Brandenburg Concerto provides fascinating insights into Bach's compositional process. The differences between this version and the final Brandenburg show how Bach refined and expanded his musical ideas.\n\nThe work already contains the brilliant horn writing and complex textures that would characterize the later version, but in a more concentrated form. It demonstrates Bach's constant process of revision and improvement.",
                    category: "Orchestral Works"
                },

                // CHAMBER MUSIC (12 posts)
                {
                    title: "Sonatas and Partitas for Solo Violin (BWV 1001-1006): The Bible of Violin Music",
                    content: "These six works represent the pinnacle of writing for solo violin. The famous Chaconne from the D minor Partita, a 15-minute tour de force of variation form, stands as one of the greatest achievements in all music. Each work combines technical challenges with profound musical expression.\n\nThe E major Partita's Preludio, the B minor Partita's Double movements, and the C major Sonata's fugue demonstrate Bach's complete understanding of the violin's capabilities. These works continue to challenge and inspire violinists today.",
                    category: "Chamber Music"
                },
                {
                    title: "Suites for Solo Cello (BWV 1007-1012): Solitary Masterpieces",
                    content: "Bach's six suites for unaccompanied cello represent a remarkable achievement in creating complete musical statements with a single line instrument. From the famous Prelude of the First Suite to the profound Sarabande of the Fifth, each movement creates its own complete world.\n\nThe Fourth Suite's Prelude, with its brilliant broken chords, the Fifth Suite's scordatura tuning, and the Sixth Suite's writing for five-string cello show Bach exploring the instrument's full potential. Pablo Casals' discovery and championing of these works brought them to worldwide attention.",
                    category: "Chamber Music"
                },
                {
                    title: "Sonatas for Violin and Harpsichord (BWV 1014-1019): Equal Partners",
                    content: "These six sonatas revolutionized chamber music by treating the harpsichord as an equal partner rather than merely an accompaniment. The slow movements create extraordinary dialogues between the instruments, while the fast movements show Bach's mastery of trio texture.\n\nThe E major Sonata's Adagio, the B minor Sonata's Allegro, and the G major Sonata's alternative movements demonstrate Bach's variety of approach within the form. These works influenced the development of the Classical sonata.",
                    category: "Chamber Music"
                },
                {
                    title: "Sonatas for Viola da Gamba and Harpsichord (BWV 1027-1029): Deep Voices",
                    content: "These three sonatas show Bach's mastery of the viola da gamba's unique voice. The G major Sonata's flowing lines, the D major Sonata's complex textures, and the G minor Sonata's profound slow movement create perfect dialogues between the instruments.\n\nThe works combine French grace with German counterpoint, creating a unique synthesis of national styles. The final movement of the G minor Sonata is particularly effective in its combination of drive and complexity.",
                    category: "Chamber Music"
                },
                {
                    title: "Musical Offering (BWV 1079): A Royal Gift",
                    content: "Created from a theme given to Bach by Frederick the Great, this collection includes some of Bach's most sophisticated chamber music. The three-voice Ricercar, the six-voice Ricercar (both for keyboard), and especially the Trio Sonata demonstrate Bach's contrapuntal mastery.\n\nThe Trio Sonata, written for flute (Frederick's instrument), violin, and continuo, combines galant style with profound counterpoint. The canons explore every possible contrapuntal device while maintaining musical interest.",
                    category: "Chamber Music"
                },
                {
                    title: "Sonatas for Flute and Harpsichord (BWV 1030-1032): Wind and Keys",
                    content: "These sonatas show Bach adapting his trio sonata style for flute and obbligato harpsichord. The B minor Sonata's expansive first movement, the A major Sonata's graceful Largo, and the E-flat Sonata's brilliant finale demonstrate Bach's understanding of the flute's capabilities.\n\nThe works combine French grace with Italian brilliance, creating perfect vehicles for both instruments. The slow movements are particularly beautiful examples of Bach's melodic gift.",
                    category: "Chamber Music"
                },
                {
                    title: "Art of Fugue (BWV 1080): Final Testament",
                    content: "Though often played by keyboard instruments, many of these pieces work beautifully as chamber music. The four-voice fugues, when played by string quartet, reveal new aspects of Bach's counterpoint. The mirror fugues, in particular, demonstrate Bach's complete mastery of invertible counterpoint.\n\nThe final unfinished fugue, breaking off in the middle of introducing the B-A-C-H motif, creates one of music's most poignant",
                    category: "Chamber Music"
                }
            ];

            // Create each post
            for (const post of bachPosts) {
                await page.getByTestId('post-title-input').fill(post.title);
                await page.getByTestId('post-content-input').fill(post.content);
                // Category selection uses custom MultiSelect in current UI.
                await page.locator('#categories [role="button"]').click();
                await page.locator('#categories').getByRole('button', { name: post.category, exact: true }).click();
                await page.locator('#categories [role="button"]').click();
                
                await expect(page.getByTestId('publish-post-button')).toBeEnabled();
                await page.getByTestId('publish-post-button').click();
                
                // Wait for database sync
                await page.waitForTimeout(1000);
                
                // Verify post creation
                await expect(async () => {
                    const titles = await page.getByTestId('post-item-title').allTextContents();
                    // Title can be visually truncated in the list; match full title or shared prefix.
                    expect(
                        titles.some(title =>
                            title === post.title ||
                            post.title.startsWith(title.replace('...', '')) ||
                            title.startsWith(post.title.slice(0, 24))
                        )
                    ).toBeTruthy();
                }).toPass({ timeout: 100000 });
            }

            // Verify total post count
            const postElements = await page.getByTestId('post-item-title').all();
            expect(postElements.length).toBe(bachPosts.length);
        });

        test.afterAll(async () => {
            await page.close();
        });
    });
});
