/**
 * Every icon in the app, by what it means rather than what it looks like.
 *
 * Nothing imports mochi-icons directly. When a sticker we want doesn't exist
 * yet, the entry points at a visibly neutral placeholder — the "bait" — and
 * carries a TODO naming the real one. Swapping a bait for the real sticker is
 * then a one-line change here, and `grep "TODO.*Icon" icons.js` lists
 * everything still standing in.
 */
import { createElement } from 'react';
import { AirplaneIcon } from 'mochi-icons/AirplaneIcon';
import { AlarmClockIcon } from 'mochi-icons/AlarmClockIcon';
import { AwardBadgeIcon } from 'mochi-icons/AwardBadgeIcon';
import { BalloonIcon } from 'mochi-icons/BalloonIcon';
import { BankNoteIcon } from 'mochi-icons/BankNoteIcon';
import { BeerMugIcon } from 'mochi-icons/BeerMugIcon';
import { BellIcon } from 'mochi-icons/BellIcon';
import { BookmarkIcon } from 'mochi-icons/BookmarkIcon';
import { BriefcaseIcon } from 'mochi-icons/BriefcaseIcon';
import { CactusIcon } from 'mochi-icons/CactusIcon';
import { CameraIcon } from 'mochi-icons/CameraIcon';
import { CarIcon } from 'mochi-icons/CarIcon';
import { CheckIcon } from 'mochi-icons/CheckIcon';
import { CloudMoonIcon } from 'mochi-icons/CloudMoonIcon';
import { ConfettiIcon } from 'mochi-icons/ConfettiIcon';
import { CreditCardIcon } from 'mochi-icons/CreditCardIcon';
import { DiamondIcon } from 'mochi-icons/DiamondIcon';
import { DiscoBallIcon } from 'mochi-icons/DiscoBallIcon';
import { EditIcon } from 'mochi-icons/EditIcon';
import { EnvelopeIcon } from 'mochi-icons/EnvelopeIcon';
import { FireIcon } from 'mochi-icons/FireIcon';
import { GreenFlagIcon } from 'mochi-icons/GreenFlagIcon';
import { HotAirBalloonIcon } from 'mochi-icons/HotAirBalloonIcon';
import { InfoCircleIcon } from 'mochi-icons/InfoCircleIcon';
import { KiteIcon } from 'mochi-icons/KiteIcon';
import { LocationIcon } from 'mochi-icons/LocationIcon';
import { MapIcon } from 'mochi-icons/MapIcon';
import { RainbowIcon } from 'mochi-icons/RainbowIcon';
import { RamenBowlIcon } from 'mochi-icons/RamenBowlIcon';
import { ReceiptIcon } from 'mochi-icons/ReceiptIcon';
import { RedFlagIcon } from 'mochi-icons/RedFlagIcon';
import { RocketIcon } from 'mochi-icons/RocketIcon';
import { SearchIcon } from 'mochi-icons/SearchIcon';
import { SettingsGrayIcon } from 'mochi-icons/SettingsGrayIcon';
import { ShoppingCartIcon } from 'mochi-icons/ShoppingCartIcon';
import { SunIcon } from 'mochi-icons/SunIcon';
import { UserIcon } from 'mochi-icons/UserIcon';
import { WineGlassIcon } from 'mochi-icons/WineGlassIcon';
import { WorldIcon } from 'mochi-icons/WorldIcon';
import { XIcon } from 'mochi-icons/XIcon';

/**
 * A plus, drawn here because the library has none and the usual stand-in would
 * be worse than nothing: CrossIcon is a diagonal X, and a bookmark on an "add"
 * button says the wrong thing entirely. Still counted as a bait, so it swaps
 * out the day a real sticker lands.
 */
const PlusGlyph = ({ size = 18, color = 'currentColor', strokeWidth = 2.2, ...rest }) =>
  createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', ...rest },
    createElement('path', { key: 'v', d: 'M12 5.5v13' }),
    createElement('path', { key: 'h', d: 'M5.5 12h13' })
  );

/** The stand-in for a sticker the library doesn't have yet. */
export const BAIT = BookmarkIcon;

const real = (Component) => ({ Component, isBait: false });
const bait = (Component = BAIT) => ({ Component, isBait: true });

export const ICONS = {
  /* ---- places and the journey ---- */
  originFlag: real(GreenFlagIcon),
  returnFlag: real(RedFlagIcon),
  place: real(LocationIcon),
  mapTab: real(MapIcon),
  explore: real(WorldIcon),
  search: real(SearchIcon),
  attraction: real(CameraIcon),
  hiddenGem: real(DiamondIcon),
  rankingBadge: real(AwardBadgeIcon),

  /* ---- eating and going out ---- */
  food: real(RamenBowlIcon),
  bar: real(BeerMugIcon),
  wine: real(WineGlassIcon),
  nightlife: real(DiscoBallIcon),
  shopping: real(ShoppingCartIcon),

  /* ---- transport ---- */
  flight: real(AirplaneIcon),
  car: real(CarIcon),
  train: bait(), // TODO: TrainIcon
  bus: bait(), // TODO: BusIcon
  auto: bait(), // TODO: AutoRickshawIcon
  taxi: bait(CarIcon), // TODO: TaxiIcon
  walk: bait(), // TODO: WalkingIcon

  /* ---- staying and timing ---- */
  hotel: bait(), // TODO: HotelIcon / BedIcon
  luggage: bait(BriefcaseIcon), // TODO: SuitcaseIcon
  calendar: bait(), // TODO: CalendarIcon
  time: real(AlarmClockIcon),
  dayArrival: real(SunIcon),
  nightArrival: real(CloudMoonIcon),

  /* ---- money ---- */
  money: real(BankNoteIcon),
  creditCard: real(CreditCardIcon),
  rupee: bait(BankNoteIcon), // TODO: RupeeIcon
  wallet: bait(BankNoteIcon), // TODO: WalletIcon
  ticket: bait(ReceiptIcon), // TODO: TicketIcon
  priceSliders: bait(SettingsGrayIcon), // TODO: SlidersIcon

  /* ---- scenery ---- */
  mountain: bait(), // TODO: MountainIcon
  beach: bait(), // TODO: BeachIcon
  landmark: bait(), // TODO: LandmarkIcon
  cafe: bait(), // TODO: CoffeeCupIcon
  compass: bait(), // TODO: CompassIcon
  treasureChest: bait(), // TODO: TreasureChestIcon

  /* ---- chrome ---- */
  edit: real(EditIcon),
  close: real(XIcon),
  check: real(CheckIcon),
  info: real(InfoCircleIcon),
  settings: real(SettingsGrayIcon),
  traveller: real(UserIcon),
  bookmark: real(BookmarkIcon),
  notify: real(BellIcon),
  star: bait(AwardBadgeIcon), // TODO: StarIcon
  chat: bait(EnvelopeIcon), // TODO: ChatBubbleIcon
  download: bait(), // TODO: DownloadIcon
  add: bait(PlusGlyph), // TODO: PlusIcon

  /* ---- the playful set, for the adventure map ---- */
  funBalloon: real(HotAirBalloonIcon),
  funBalloon2: real(BalloonIcon),
  funKite: real(KiteIcon),
  funRocket: real(RocketIcon),
  funConfetti: real(ConfettiIcon),
  funRainbow: real(RainbowIcon),
  funFire: real(FireIcon),
  funCactus: real(CactusIcon),
  funSun: real(SunIcon),
  funGem: real(DiamondIcon),
};

/** The component for a semantic name, falling back to the bait. */
export const iconFor = (name) => (ICONS[name] ?? { Component: BAIT }).Component;

/** Whether what you'd render is a placeholder — handy for a dev badge. */
export const isBait = (name) => (ICONS[name] ?? { isBait: true }).isBait;

/** Transport mode as the planner spells it -> an icon name in this map. */
export const TRANSPORT_ICON = {
  train: 'train',
  bus: 'bus',
  flight: 'flight',
  car: 'car',
  auto: 'auto',
  cab: 'taxi',
  taxi: 'taxi',
  walk: 'walk',
};

/** Activity category as the schema spells it -> an icon name in this map. */
export const CATEGORY_ICON = {
  attraction: 'attraction',
  cafe: 'cafe',
  meal: 'food',
  hidden_gem: 'hiddenGem',
  activity: 'explore',
  transit: 'place',
};
