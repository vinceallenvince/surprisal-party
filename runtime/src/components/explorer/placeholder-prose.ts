/**
 * Static placeholder prose for the Phase 2 Step 1 shell.
 *
 * NO data binding yet — Step 2 replaces this with the fetched corpus JSON.
 * The text mirrors the opening of "Little Red Riding Hood" shown in Figma
 * frame 28-163 so the shell reads on-spec. `kernel: true` marks the
 * coral-highlighted kernel tokens from the frame; this is a hand-authored
 * stand-in, not derived from the cache.
 */

export type ProseToken = {
  text: string;
  kernel?: boolean;
};

export const PLACEHOLDER_PROSE: ProseToken[] = [
  {
    text: 'Once upon a time there was a dear little girl who was loved by ',
  },
  { text: 'everyone', kernel: true },
  {
    text: ' who looked at her, but most of all by her grandmother, and there was nothing that she would not have given to the child. Once she gave her a little cap of red velvet, which suited her so well that she would never wear ',
  },
  { text: 'anything', kernel: true },
  { text: ' else; so she was always called ‘Little ' },
  { text: 'Red-Cap.’', kernel: true },
  {
    text: ' One day her mother said to her: ‘Come, Little Red-Cap, here is a piece of cake and a bottle of wine; take them to your grandmother, she is ill and weak, and they will do her good. Set out before it gets hot, and when you are going, walk nicely and quietly and do not run off the path, or you may fall and break the bottle, and then your grandmother will get ',
  },
  { text: 'nothing;', kernel: true },
  {
    text: ' and when you go into her room, don’t forget to say, “Good morning”, and don’t peep into every corner before you do it.’ ‘I will take great care,’ said Little Red-Cap to her mother, and gave her hand on it. The grandmother lived out in the wood, half a league from the ',
  },
  { text: 'village,', kernel: true },
  {
    text: ' and just as Little Red-Cap entered the wood, a wolf met her. Red-Cap did not know what a wicked creature he was, and was not at all afraid of him. ‘Good day, Little Red-Cap,’ said he. ‘Thank you kindly, wolf.’ ‘Whither away so early, Little Red-Cap?’ ‘To my grandmother’s.’ ‘What have you got in your apron?’ ‘Cake and wine; yesterday was baking-day, so poor sick grandmother is to have ',
  },
  { text: 'something', kernel: true },
  { text: ' good, to make her ' },
  { text: 'stronger.’', kernel: true },
  {
    text: ' ‘Where does your grandmother live, Little Red-Cap?’ ‘A good quarter of a league farther on in the wood; her house stands under the three large oak-trees, the nut-trees are just below; you surely must know it,’ replied Little Red-Cap.',
  },
];
