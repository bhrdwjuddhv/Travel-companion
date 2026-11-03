/**
 * Every icon in the app, by what it means rather than what it looks like.
 *
 * Nothing imports mochi-icons directly. When a sticker we want doesn't exist
 * yet, the entry points at a visibly neutral placeholder — the "bait" — and
 * carries a TODO naming the real one. Swapping a bait for the real sticker is
 * then a one-line change here, and `grep "TODO.*Icon" icons.js` lists
 * everything still standing in.
 */
import { AirplaneIcon } from 'mochi-icons/AirplaneIcon';
import { AlarmClockIcon } from 'mochi-icons/AlarmClockIcon';
import { AutoRickshawIcon } from 'mochi-icons/AutoRickshawIcon';
import { AwardBadgeIcon } from 'mochi-icons/AwardBadgeIcon';
import { BalloonIcon } from 'mochi-icons/BalloonIcon';
import { BankNoteIcon } from 'mochi-icons/BankNoteIcon';
import { BeachIcon } from 'mochi-icons/BeachIcon';
import { BeerMugIcon } from 'mochi-icons/BeerMugIcon';
import { BellIcon } from 'mochi-icons/BellIcon';
import { BookmarkIcon } from 'mochi-icons/BookmarkIcon';
import { BusIcon } from 'mochi-icons/BusIcon';
import { CactusIcon } from 'mochi-icons/CactusIcon';
import { CalendarIcon } from 'mochi-icons/CalendarIcon';
import { CameraIcon } from 'mochi-icons/CameraIcon';
import { CarIcon } from 'mochi-icons/CarIcon';
import { ChatBubbleIcon } from 'mochi-icons/ChatBubbleIcon';
import { CheckIcon } from 'mochi-icons/CheckIcon';
import { ChestIcon } from 'mochi-icons/ChestIcon';
import { CloudMoonIcon } from 'mochi-icons/CloudMoonIcon';
import { CoffeeCupIcon } from 'mochi-icons/CoffeeCupIcon';
import { CompassIcon } from 'mochi-icons/CompassIcon';
import { ConfettiIcon } from 'mochi-icons/ConfettiIcon';
import { CreditCardIcon } from 'mochi-icons/CreditCardIcon';
import { DiamondIcon } from 'mochi-icons/DiamondIcon';
import { DiscoBallIcon } from 'mochi-icons/DiscoBallIcon';
import { DownloadIcon } from 'mochi-icons/DownloadIcon';
import { EditIcon } from 'mochi-icons/EditIcon';
import { ExportIcon } from 'mochi-icons/ExportIcon';
import { FireIcon } from 'mochi-icons/FireIcon';
import { GreenFlagIcon } from 'mochi-icons/GreenFlagIcon';
import { HotAirBalloonIcon } from 'mochi-icons/HotAirBalloonIcon';
import { HotelIcon } from 'mochi-icons/HotelIcon';
import { InfoCircleIcon } from 'mochi-icons/InfoCircleIcon';
import { KiteIcon } from 'mochi-icons/KiteIcon';
import { LocationIcon } from 'mochi-icons/LocationIcon';
import { MapIcon } from 'mochi-icons/MapIcon';
import { MonumentIcon } from 'mochi-icons/MonumentIcon';
import { MountainIcon } from 'mochi-icons/MountainIcon';
import { PlusIcon } from 'mochi-icons/PlusIcon';
import { RainbowIcon } from 'mochi-icons/RainbowIcon';
import { RamenBowlIcon } from 'mochi-icons/RamenBowlIcon';
import { RedFlagIcon } from 'mochi-icons/RedFlagIcon';
import { RocketIcon } from 'mochi-icons/RocketIcon';
import { RupeeIcon } from 'mochi-icons/RupeeIcon';
import { SearchIcon } from 'mochi-icons/SearchIcon';
import { SettingsGrayIcon } from 'mochi-icons/SettingsGrayIcon';
import { ShoppingCartIcon } from 'mochi-icons/ShoppingCartIcon';
import { SliderIcon } from 'mochi-icons/SliderIcon';
import { StarIcon } from 'mochi-icons/StarIcon';
import { SuitcaseIcon } from 'mochi-icons/SuitcaseIcon';
import { SunIcon } from 'mochi-icons/SunIcon';
import { TicketIcon } from 'mochi-icons/TicketIcon';
import { TrainIcon } from 'mochi-icons/TrainIcon';
import { UserIcon } from 'mochi-icons/UserIcon';
import { WalkingIcon } from 'mochi-icons/WalkingIcon';
import { WalletIcon } from 'mochi-icons/WalletIcon';
import { WineGlassIcon } from 'mochi-icons/WineGlassIcon';
import { WorldIcon } from 'mochi-icons/WorldIcon';
import { XIcon } from 'mochi-icons/XIcon';

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
  train: real(TrainIcon),
  bus: real(BusIcon),
  auto: real(AutoRickshawIcon),
  taxi: bait(CarIcon), // TODO: TaxiIcon — the library still has no cab
  walk: real(WalkingIcon),

  /* ---- staying and timing ---- */
  hotel: real(HotelIcon),
  luggage: real(SuitcaseIcon),
  calendar: real(CalendarIcon),
  time: real(AlarmClockIcon),
  dayArrival: real(SunIcon),
  nightArrival: real(CloudMoonIcon),

  /* ---- money ---- */
  money: real(BankNoteIcon),
  creditCard: real(CreditCardIcon),
  rupee: real(RupeeIcon),
  wallet: real(WalletIcon),
  ticket: real(TicketIcon),
  priceSliders: real(SliderIcon),

  /* ---- scenery ---- */
  mountain: real(MountainIcon),
  beach: real(BeachIcon),
  landmark: real(MonumentIcon),
  cafe: real(CoffeeCupIcon),
  compass: real(CompassIcon),
  treasureChest: real(ChestIcon),

  /* ---- chrome ---- */
  edit: real(EditIcon),
  close: real(XIcon),
  check: real(CheckIcon),
  info: real(InfoCircleIcon),
  settings: real(SettingsGrayIcon),
  traveller: real(UserIcon),
  bookmark: real(BookmarkIcon),
  notify: real(BellIcon),
  star: real(StarIcon),
  chat: real(ChatBubbleIcon),
  download: real(DownloadIcon),
  export: real(ExportIcon),
  add: real(PlusIcon),

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
