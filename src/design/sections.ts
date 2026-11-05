/**
 * Ready-made sections for the Design view: one tap adds a finished, good-looking part of a page
 * (hero, features, pricing, contact form…). Everything inside is normal components you can change.
 */
import { COMPONENT_BY_TYPE, allNodes, safeThingName, type CompType, type Design, type DesignNode, type PropValue } from './model';
import { newId } from '../model/project';

export interface SectionSpec {
  id: string;
  label: string;
  icon: string;
  help: string;
  build: (mk: Maker) => DesignNode;
}

export type Maker = (type: CompType, name: string, props?: Record<string, PropValue>, children?: DesignNode[]) => DesignNode;

/** A node factory that gives every node a fresh id and a name not used anywhere in `d`. */
export function maker(d: Design): Maker {
  const taken = new Set(allNodes(d).map((n) => n.name));
  return (type, name, props = {}, children) => {
    const spec = COMPONENT_BY_TYPE.get(type)!;
    const base = safeThingName(name);
    let unique = base;
    for (let i = 2; taken.has(unique); i++) unique = `${base}${i}`;
    taken.add(unique);
    const node: DesignNode = { id: newId('n'), type, name: unique, props: { ...spec.defaults, ...props } };
    if (spec.container) node.children = children ?? [];
    return node;
  };
}

const card = (mk: Maker, key: string, emoji: string, title: string, text: string) =>
  mk('card', `${key}Card`, { textAlign: 'left' }, [
    mk('character', `${key}Icon`, { emoji, size: 36 }),
    mk('title', `${key}Title`, { text: title, level: '3' }),
    mk('text', `${key}Text`, { text }),
  ]);

export const SECTIONS: SectionSpec[] = [
  {
    id: 'hero', label: 'Hero', icon: '🌅', help: 'A big welcome at the top: title, words and two buttons.',
    build: (mk) => mk('section', 'hero', { padding: 64, bg: '#f1efff', gap: 16 }, [
      mk('badge', 'heroBadge', { text: 'New' }),
      mk('title', 'heroTitle', { text: 'Your big idea goes here' }),
      mk('text', 'heroText', { text: 'One or two short sentences that explain what this is and why people will love it.', size: 19 }),
      mk('row', 'heroButtons', { justify: 'center' }, [
        mk('button', 'getStarted', { text: 'Get started' }),
        mk('button', 'learnMore', { text: 'Learn more', variant: 'outline' }),
      ]),
    ]),
  },
  {
    id: 'features', label: 'Features', icon: '✨', help: 'Three cards that show what is good about it.',
    build: (mk) => mk('section', 'features', { padding: 48 }, [
      mk('title', 'featuresTitle', { text: 'Why you’ll love it', level: '2' }),
      mk('grid', 'featureGrid', { columns: 3 }, [
        card(mk, 'fast', '⚡', 'Fast', 'Works in a blink on phones and computers.'),
        card(mk, 'easy', '🧩', 'Easy', 'Anyone can use it in a few seconds.'),
        card(mk, 'safe', '🛡', 'Safe', 'Your things stay private and protected.'),
      ]),
    ]),
  },
  {
    id: 'pricing', label: 'Pricing', icon: '💳', help: 'Three price plans side by side.',
    build: (mk) => {
      const plan = (key: string, title: string, price: string, items: string, best = false) =>
        mk('card', `${key}Plan`, { textAlign: 'left', border: best ? '#5b4bdb' : '', borderWidth: best ? 2 : '' }, [
          ...(best ? [mk('badge', `${key}Badge`, { text: 'Most popular' })] : []),
          mk('title', `${key}Name`, { text: title, level: '3' }),
          mk('title', `${key}Price`, { text: price, level: '2' }),
          mk('list', `${key}Items`, { items }),
          mk('button', `${key}Choose`, { text: 'Choose', variant: best ? 'primary' : 'outline' }),
        ]);
      return mk('section', 'pricing', { padding: 48 }, [
        mk('title', 'pricingTitle', { text: 'Simple prices', level: '2' }),
        mk('grid', 'pricingGrid', { columns: 3 }, [
          plan('free', 'Free', '$0', 'One project\nBasic help'),
          plan('pro', 'Pro', '$9 / month', 'Ten projects\nFast help\nNo ads', true),
          plan('team', 'Team', '$29 / month', 'Everything in Pro\nUp to 10 people'),
        ]),
      ]);
    },
  },
  {
    id: 'testimonials', label: 'Reviews', icon: '💬', help: 'Kind words from happy people.',
    build: (mk) => mk('section', 'reviews', { padding: 48, bg: '#fafaf7' }, [
      mk('title', 'reviewsTitle', { text: 'What people say', level: '2' }),
      mk('grid', 'reviewGrid', { columns: 3 }, [
        ...[['😀', '“It changed how I work. I use it every day!”', 'Sam, teacher'], ['🤩', '“So simple — I made my first app in an hour.”', 'Alex, student'], ['😎', '“Beautiful and fast. Highly recommended.”', 'Rio, designer']]
          .map(([e, q, who], i) => mk('card', `review${i + 1}`, { textAlign: 'left' }, [
            mk('character', `reviewFace${i + 1}`, { emoji: e, size: 40 }),
            mk('text', `reviewQuote${i + 1}`, { text: q }),
            mk('text', `reviewName${i + 1}`, { text: who, bold: true, size: 14 }),
          ])),
      ]),
    ]),
  },
  {
    id: 'gallery', label: 'Gallery', icon: '🖼', help: 'A grid of six pictures. Choose your own pictures for each.',
    build: (mk) => mk('section', 'gallery', { padding: 48 }, [
      mk('title', 'galleryTitle', { text: 'Gallery', level: '2' }),
      mk('grid', 'galleryGrid', { columns: 3, gap: 12 }, [1, 2, 3, 4, 5, 6].map((i) => mk('image', `photo${i}`, { width: '100%', fit: 'cover', radius: 12, height: '180' }))),
    ]),
  },
  {
    id: 'faq', label: 'FAQ', icon: '❓', help: 'Questions that open to show their answers.',
    build: (mk) => mk('section', 'faqSection', { width: 'narrow', padding: 48, align: 'stretch' }, [
      mk('title', 'faqTitle', { text: 'Questions', level: '2' }),
      mk('faq', 'question1', { text: 'Is it free?', answer: 'Yes! You can start for free.' }),
      mk('faq', 'question2', { text: 'Does it work on phones?', answer: 'Yes, on phones, tablets and computers.' }),
      mk('faq', 'question3', { text: 'How do I get help?', answer: 'Write to us and we’ll answer quickly.' }),
    ]),
  },
  {
    id: 'stats', label: 'Numbers', icon: '📊', help: 'Three big numbers that show results.',
    build: (mk) => mk('section', 'stats', { padding: 40, bg: '#5b4bdb', color: '#ffffff' }, [
      mk('grid', 'statsGrid', { columns: 3 }, [['10k+', 'happy users'], ['4.9★', 'average rating'], ['24/7', 'friendly help']].map(([big, small], i) =>
        mk('column', `stat${i + 1}`, { align: 'center', gap: 2 }, [
          mk('title', `statNumber${i + 1}`, { text: big, level: '2' }),
          mk('text', `statLabel${i + 1}`, { text: small }),
        ]))),
    ]),
  },
  {
    id: 'team', label: 'Team', icon: '👥', help: 'People with a round picture, name and job.',
    build: (mk) => mk('section', 'team', { padding: 48 }, [
      mk('title', 'teamTitle', { text: 'Meet the team', level: '2' }),
      mk('grid', 'teamGrid', { columns: 3 }, [['Ana', 'Founder'], ['Ben', 'Designer'], ['Chen', 'Developer']].map(([name, job], i) =>
        mk('card', `person${i + 1}`, { align: 'center', textAlign: 'center' }, [
          mk('image', `personPhoto${i + 1}`, { width: '96', round: true, fit: 'cover' }),
          mk('title', `personName${i + 1}`, { text: name, level: '3' }),
          mk('text', `personJob${i + 1}`, { text: job }),
        ]))),
    ]),
  },
  {
    id: 'contact', label: 'Contact form', icon: '✉', help: 'Name, email, message and a Send button.',
    build: (mk) => mk('section', 'contact', { width: 'narrow', padding: 48, align: 'stretch', textAlign: 'left' }, [
      mk('title', 'contactTitle', { text: 'Contact us', level: '2' }),
      mk('card', 'contactForm', { gap: 14 }, [
        mk('input', 'contactName', { label: 'Name', placeholder: 'Your name' }),
        mk('input', 'contactEmail', { label: 'Email', placeholder: 'you@example.com', inputType: 'email' }),
        mk('textarea', 'contactMessage', { label: 'Message', placeholder: 'How can we help?' }),
        mk('button', 'contactSend', { text: 'Send message', tap: 'say', tapValue: 'Thanks! We’ll write back soon.' }),
      ]),
    ]),
  },
  {
    id: 'login', label: 'Log in', icon: '🔑', help: 'Email, password and a Log in button.',
    build: (mk) => mk('section', 'login', { width: 'narrow', padding: 48, align: 'stretch', textAlign: 'left' }, [
      mk('card', 'loginCard', { gap: 14, padding: 28 }, [
        mk('title', 'loginTitle', { text: 'Welcome back', level: '2' }),
        mk('input', 'loginEmail', { label: 'Email', placeholder: 'you@example.com', inputType: 'email' }),
        mk('input', 'loginPassword', { label: 'Password', placeholder: '••••••••', inputType: 'password' }),
        mk('checkbox', 'rememberMe', { text: 'Remember me' }),
        mk('button', 'loginButton', { text: 'Log in' }),
        mk('link', 'forgotPassword', { text: 'Forgot your password?', url: '#' }),
      ]),
    ]),
  },
  {
    id: 'signup', label: 'Sign up', icon: '📝', help: 'A form to make an account.',
    build: (mk) => mk('section', 'signup', { width: 'narrow', padding: 48, align: 'stretch', textAlign: 'left' }, [
      mk('card', 'signupCard', { gap: 14, padding: 28 }, [
        mk('title', 'signupTitle', { text: 'Create your account', level: '2' }),
        mk('input', 'signupName', { label: 'Name', placeholder: 'Your name' }),
        mk('input', 'signupEmail', { label: 'Email', placeholder: 'you@example.com', inputType: 'email' }),
        mk('input', 'signupPassword', { label: 'Password', placeholder: 'At least 8 letters', inputType: 'password' }),
        mk('checkbox', 'agree', { text: 'I agree to the rules' }),
        mk('button', 'signupButton', { text: 'Sign up' }),
      ]),
    ]),
  },
  {
    id: 'footer', label: 'Footer', icon: '⬇', help: 'The bottom of the page with your name and links.',
    build: (mk) => mk('section', 'footer', { padding: 28, bg: '#1d2433', color: '#ffffff', gap: 8 }, [
      mk('row', 'footerLinks', { justify: 'center', gap: 18 }, [
        mk('link', 'footerAbout', { text: 'About', url: '#', color: '#ffffff' }),
        mk('link', 'footerContact', { text: 'Contact', url: '#', color: '#ffffff' }),
        mk('link', 'footerPrivacy', { text: 'Privacy', url: '#', color: '#ffffff' }),
      ]),
      mk('text', 'footerText', { text: '© 2026 My Company', size: 14 }),
    ]),
  },
];
