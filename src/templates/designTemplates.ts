/**
 * Starters made with the Design view (design.json) plus a few blocks — examples of
 * professional-looking apps and websites that need no HTML or CSS.
 */
import { COMPONENT_BY_TYPE, DEFAULT_THEME, type CompType, type Design, type DesignNode, type PropValue } from '../design/model';
import type { Template } from './templates';

function n(type: CompType, name: string, props: Record<string, PropValue> = {}, children?: DesignNode[]): DesignNode {
  const spec = COMPONENT_BY_TYPE.get(type)!;
  const node: DesignNode = { id: `n_${name}`, type, name, props: { ...spec.defaults, ...props } };
  if (spec.container) node.children = children ?? [];
  return node;
}

const PAGE_HTML = `<!doctype html>
<html>
<head><title>My project</title></head>
<body>
</body>
</html>
`;

const PAGE_CSS = `body {
  margin: 0;
}
`;

// ------------------------------------------------------------------ Shop app

const product = (key: string, emoji: string, title: string, price: string) =>
  n('card', `${key}Card`, { align: 'center', textAlign: 'center' }, [
    n('character', `${key}Pic`, { emoji, size: 56 }),
    n('title', `${key}Name`, { text: title, level: '3' }),
    n('text', `${key}Price`, { text: price, bold: true, color: '#2b8a3e' }),
    n('button', `${key}Buy`, { text: 'Add to basket', variant: 'soft' }),
  ]);

const shopDesign: Design = {
  version: 1,
  theme: { ...DEFAULT_THEME, primary: '#e8590c', font: 'rounded', corners: 'round' },
  screens: [
    {
      id: 'scr_home', name: 'Home', background: '#fff8f3',
      nodes: [
        n('navbar', 'nav', { text: '🧁 Sweet Shop' }),
        n('section', 'hero', { padding: 48, gap: 14 }, [
          n('character', 'heroPic', { emoji: '🍰', size: 84 }),
          n('title', 'heroTitle', { text: 'Fresh cakes, every day' }),
          n('text', 'heroText', { text: 'Pick your favourites and we’ll bake them for you.' }),
          n('row', 'heroButtons', { justify: 'center' }, [
            n('button', 'browse', { text: 'See the cakes', tap: 'screen', tapValue: 'Cakes' }),
            n('button', 'contactLink', { text: 'Contact us', variant: 'outline', tap: 'screen', tapValue: 'Contact' }),
          ]),
          n('text', 'basket', { text: 'Basket: 0 items', bold: true }),
        ]),
      ],
    },
    {
      id: 'scr_cakes', name: 'Cakes', background: '#fff8f3',
      nodes: [
        n('navbar', 'nav2', { text: '🧁 Sweet Shop' }),
        n('section', 'cakes', { padding: 32 }, [
          n('title', 'cakesTitle', { text: 'Our cakes', level: '2' }),
          n('row', 'cakeRow', { align: 'stretch', gap: 16 }, [
            product('choc', '🍫', 'Chocolate', '$4.50'),
            product('straw', '🍓', 'Strawberry', '$4.00'),
            product('lemon', '🍋', 'Lemon', '$3.50'),
          ]),
        ]),
      ],
    },
    {
      id: 'scr_contact', name: 'Contact', background: '#fff8f3',
      nodes: [
        n('navbar', 'nav3', { text: '🧁 Sweet Shop' }),
        n('section', 'contact', { width: 'narrow', padding: 32, align: 'stretch', textAlign: 'left' }, [
          n('title', 'contactTitle', { text: 'Say hello', level: '2' }),
          n('card', 'form', { gap: 14 }, [
            n('input', 'name', { label: 'Your name', placeholder: 'Sam' }),
            n('input', 'email', { label: 'Email', placeholder: 'sam@example.com', inputType: 'email' }),
            n('textarea', 'message', { label: 'Message', placeholder: 'What would you like?' }),
            n('checkbox', 'newsletter', { text: 'Send me news about new cakes' }),
            n('button', 'send', { text: 'Send message' }),
          ]),
        ]),
      ],
    },
  ],
};

const shopJs = `let items = 0;

onClick("chocBuy", async () => {
  await addToBasket();
});

onClick("strawBuy", async () => {
  await addToBasket();
});

onClick("lemonBuy", async () => {
  await addToBasket();
});

onClick("send", async () => {
  if (getValue("name") === "") {
    say("Please type your name first.");
  } else {
    say(join("Thanks, ", join(getValue("name"), "! We'll write back soon.")));
    setValue("message", "");
  }
});

async function addToBasket() {
  items += 1;
  setText("basket", join("Basket: ", join(items, " items")));
  playSound("coin");
  say("Added to your basket!");
}
`;

// ------------------------------------------------------------------ Business website

const feature = (key: string, emoji: string, title: string, text: string) =>
  n('card', `${key}Card`, { textAlign: 'left' }, [
    n('character', `${key}Icon`, { emoji, size: 36 }),
    n('title', `${key}Title`, { text: title, level: '3' }),
    n('text', `${key}Text`, { text }),
  ]);

const businessDesign: Design = {
  version: 1,
  theme: { ...DEFAULT_THEME, primary: '#1c7ed6', font: 'modern', corners: 'rounded' },
  screens: [
    {
      id: 'scr_home', name: 'Home', background: '',
      nodes: [
        n('navbar', 'nav', { text: 'Brightside Studio' }),
        n('section', 'hero', { padding: 72, bg: '#e7f5ff', gap: 18 }, [
          n('title', 'heroTitle', { text: 'We build websites people love' }),
          n('text', 'heroText', { text: 'Design, development and friendly support for small businesses.', size: 19 }),
          n('row', 'heroButtons', { justify: 'center' }, [
            n('button', 'start', { text: 'Start a project', tap: 'screen', tapValue: 'Contact' }),
            n('button', 'work', { text: 'See our work', variant: 'outline', tap: 'screen', tapValue: 'Work' }),
          ]),
        ]),
        n('section', 'features', { padding: 56 }, [
          n('title', 'featuresTitle', { text: 'What we do', level: '2' }),
          n('row', 'featureRow', { align: 'stretch', gap: 18 }, [
            feature('design', '🎨', 'Design', 'Clean, modern looks that match your brand.'),
            feature('build', '⚡', 'Build', 'Fast pages that work on every phone and computer.'),
            feature('care', '🤝', 'Care', 'We keep your site safe and up to date.'),
          ]),
        ]),
        n('section', 'footer', { padding: 24, bg: '#1d2433', color: '#ffffff' }, [
          n('text', 'footerText', { text: '© Brightside Studio · hello@brightside.example', size: 14 }),
        ]),
      ],
    },
    {
      id: 'scr_work', name: 'Work', background: '',
      nodes: [
        n('navbar', 'nav2', { text: 'Brightside Studio' }),
        n('section', 'workSection', { padding: 48, textAlign: 'left', align: 'stretch' }, [
          n('title', 'workTitle', { text: 'Recent work', level: '2' }),
          n('list', 'workList', { items: 'Bakery website with online orders\nSports club booking app\nPortfolio for a photographer' }),
        ]),
      ],
    },
    {
      id: 'scr_contact', name: 'Contact', background: '',
      nodes: [
        n('navbar', 'nav3', { text: 'Brightside Studio' }),
        n('section', 'contactSection', { width: 'narrow', padding: 48, align: 'stretch', textAlign: 'left' }, [
          n('title', 'contactTitle', { text: 'Tell us about your project', level: '2' }),
          n('input', 'name', { label: 'Name', placeholder: 'Your name' }),
          n('select', 'kind', { label: 'What do you need?', options: 'A new website, An app, Help with my site' }),
          n('slider', 'budget', { label: 'Budget (hundreds of $)', min: 1, max: 50, value: 10 }),
          n('text', 'budgetText', { text: 'Budget: $1000' }),
          n('button', 'send', { text: 'Send' }),
        ]),
      ],
    },
  ],
};

const businessJs = `onChange("budget", async () => {
  setText("budgetText", join("Budget: $", getValue("budget") * 100));
});

onClick("send", async () => {
  say(join("Thanks ", join(getValue("name"), "! We'll be in touch.")));
});
`;

export const DESIGN_TEMPLATES: Template[] = [
  {
    id: 'app-shop', type: 'app', name: 'Shop App', emoji: '🧁', colors: ['#ff922b', '#ffd8a8'],
    description: 'Three screens with a nav bar, product cards, a basket counter and a contact form.',
    nextIdeas: ['In Design, change the cakes into your own products — add your pictures with “Picture”.', 'Add a fourth cake: select a card, press Duplicate, then change its words.', 'Change the main colour under Theme (click an empty part of the canvas).'],
    html: PAGE_HTML, css: PAGE_CSS, js: shopJs, design: shopDesign,
  },
  {
    id: 'web-business', type: 'website', name: 'Business Website', emoji: '💼', colors: ['#339af0', '#d0ebff'],
    description: 'A professional site: hero, feature cards, a work page and a contact form.',
    nextIdeas: ['Change the name in the nav bar and the big title to your own business.', 'Add a “Prices” screen with ＋ Screen, then add a button that goes to it.', 'Try a different font and corners under Theme.'],
    html: PAGE_HTML, css: PAGE_CSS, js: businessJs, design: businessDesign,
  },
];
