/** The selectable profile-icon collection, served from public/avatars. */
export interface AvatarIcon {
  id: string; // filename — this is what's persisted on Progress.avatarIcon
  label: string;
}

export const AVATAR_ICONS: AvatarIcon[] = [
  { id: '001-turtle.png', label: 'Turtle' },
  { id: '002-koala.png', label: 'Koala' },
  { id: '003-lion.png', label: 'Lion' },
  { id: '004-chick.png', label: 'Chick' },
  { id: '005-frog.png', label: 'Frog' },
  { id: '006-crab.png', label: 'Crab' },
  { id: '007-fox.png', label: 'Fox' },
  { id: '008-bee.png', label: 'Bee' },
  { id: '009-cat.png', label: 'Cat' },
  { id: '010-whale.png', label: 'Whale' },
  { id: '011-whale-1.png', label: 'Whale' },
  { id: '012-squirrel.png', label: 'Squirrel' },
  { id: '013-sea-turtle.png', label: 'Sea turtle' },
  { id: '014-cow.png', label: 'Cow' },
  { id: '015-parrot.png', label: 'Parrot' },
  { id: '016-dog.png', label: 'Dog' },
  { id: '017-rabbit-face.png', label: 'Rabbit' },
  { id: '018-tiger.png', label: 'Tiger' },
  { id: '019-snake.png', label: 'Snake' },
  { id: '020-parrot-1.png', label: 'Parrot' },
  { id: '021-hen.png', label: 'Hen' },
];

export function avatarIconUrl(id: string): string {
  return `/avatars/${id}`;
}
