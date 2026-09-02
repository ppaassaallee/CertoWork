import type { ComponentType, SVGProps } from "react";
import * as Lucide from "lucide-react";

export const ICON_SIZES = { sm: 14, md: 16, lg: 18 } as const;
export type IconSizeName = keyof typeof ICON_SIZES;
export type IconSize = IconSizeName | number;

type LucideIconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number }>;
export type IconProps = SVGProps<SVGSVGElement> & {
  size?: IconSize;
  strokeWidth?: number;
  color?: string;
};

export function pixelSize(size?: IconSize) {
  if (typeof size === "number") return size;
  if (size && size in ICON_SIZES) return ICON_SIZES[size as IconSizeName];
  return ICON_SIZES.md;
}

function wrap(Cmp: LucideIconType, displayName: string) {
  function WrappedIcon({
    size = "md",
    strokeWidth = 1.5,
    color = "currentColor",
    ...props
  }: IconProps) {
    return (
      <Cmp
        color={color}
        size={pixelSize(size)}
        strokeWidth={strokeWidth}
        {...props}
      />
    );
  }
  WrappedIcon.displayName = displayName;
  return WrappedIcon;
}

const wrapped = Object.fromEntries(
  Object.entries(Lucide)
    .filter(
      ([name, value]) =>
        /^[A-Z]/.test(name) &&
        name !== "Icon" &&
        (typeof value === "function" || typeof value === "object"),
    )
    .map(([name, value]) => [name, wrap(value as LucideIconType, name)]),
) as { [K in keyof typeof Lucide]: ReturnType<typeof wrap> };

export const Activity = wrapped.Activity;
export const AlertCircle = wrapped.AlertCircle;
export const AlertOctagon = wrapped.AlertOctagon;
export const AlertTriangle = wrapped.AlertTriangle;
export const AlignLeft = wrapped.AlignLeft;
export const Archive = wrapped.Archive;
export const ArrowDown = wrapped.ArrowDown;
export const ArrowLeft = wrapped.ArrowLeft;
export const ArrowRight = wrapped.ArrowRight;
export const ArrowRightLeft = wrapped.ArrowRightLeft;
export const ArrowUp = wrapped.ArrowUp;
export const ArrowUpDown = wrapped.ArrowUpDown;
export const ArrowUpRight = wrapped.ArrowUpRight;
export const Award = wrapped.Award;
export const Ban = wrapped.Ban;
export const BarChart = wrapped.BarChart;
export const BarChart2 = wrapped.BarChart2;
export const BarChart3 = wrapped.BarChart3;
export const Battery = wrapped.Battery;
export const BellOff = wrapped.BellOff;
export const Bike = wrapped.Bike;
export const Book = wrapped.Book;
export const BookOpen = wrapped.BookOpen;
export const Bookmark = wrapped.Bookmark;
export const Bot = wrapped.Bot;
export const Boxes = wrapped.Boxes;
export const Brain = wrapped.Brain;
export const BrainCircuit = wrapped.BrainCircuit;
export const Briefcase = wrapped.Briefcase;
export const Bug = wrapped.Bug;
export const Calendar = wrapped.Calendar;
export const CalendarCheck = wrapped.CalendarCheck;
export const CalendarClock = wrapped.CalendarClock;
export const CalendarDays = wrapped.CalendarDays;
export const CalendarRange = wrapped.CalendarRange;
export const Check = wrapped.Check;
export const CheckCircle = wrapped.CheckCircle;
export const CheckCircle2 = wrapped.CheckCircle2;
export const CheckSquare = wrapped.CheckSquare;
export const ChevronDown = wrapped.ChevronDown;
export const ChevronLeft = wrapped.ChevronLeft;
export const ChevronRight = wrapped.ChevronRight;
export const ChevronUp = wrapped.ChevronUp;
export const Circle = wrapped.Circle;
export const CircleDot = wrapped.CircleDot;
export const Clipboard = wrapped.Clipboard;
export const ClipboardCheck = wrapped.ClipboardCheck;
export const Clock = wrapped.Clock;
export const Cloud = wrapped.Cloud;
export const Code2 = wrapped.Code2;
export const Coffee = wrapped.Coffee;
export const Command = wrapped.Command;
export const Compass = wrapped.Compass;
export const Copy = wrapped.Copy;
export const CornerDownRight = wrapped.CornerDownRight;
export const Cpu = wrapped.Cpu;
export const Database = wrapped.Database;
export const Dot = wrapped.Dot;
export const Download = wrapped.Download;
export const Dumbbell = wrapped.Dumbbell;
export const Edit = wrapped.Edit;
export const Edit2 = wrapped.Edit2;
export const Edit3 = wrapped.Edit3;
export const Eraser = wrapped.Eraser;
export const ExternalLink = wrapped.ExternalLink;
export const Eye = wrapped.Eye;
export const EyeOff = wrapped.EyeOff;
export const File = wrapped.File;
export const FileAudio = wrapped.FileAudio;
export const FileCheck2 = wrapped.FileCheck2;
export const FileCode = wrapped.FileCode;
export const FileOutput = wrapped.FileOutput;
export const FileText = wrapped.FileText;
export const Filter = wrapped.Filter;
export const Flag = wrapped.Flag;
export const GitBranch = wrapped.GitBranch;
export const Flame = wrapped.Flame;
export const Folder = wrapped.Folder;
export const FolderKanban = wrapped.FolderKanban;
export const FolderOpen = wrapped.FolderOpen;
export const FolderPlus = wrapped.FolderPlus;
export const Folders = wrapped.Folders;
export const Footprints = wrapped.Footprints;
export const Gauge = wrapped.Gauge;
export const Gem = wrapped.Gem;
export const Gift = wrapped.Gift;
export const Globe = wrapped.Globe;
export const Grid = wrapped.Grid;
export const GripVertical = wrapped.GripVertical;
export const HardHat = wrapped.HardHat;
export const Headphones = wrapped.Headphones;
export const Heart = wrapped.Heart;
export const HelpCircle = wrapped.HelpCircle;
export const History = wrapped.History;
export const Home = wrapped.Home;
export const Inbox = wrapped.Inbox;
export const Info = wrapped.Info;
export const Kanban = wrapped.Kanban;
export const Layers = wrapped.Layers;
export const Layers3 = wrapped.Layers3;
export const LayoutGrid = wrapped.LayoutGrid;
export const Lightbulb = wrapped.Lightbulb;
export const Link = wrapped.Link;
export const Link2 = wrapped.Link2;
export const List = wrapped.List;
export const ListChecks = wrapped.ListChecks;
export const ListTodo = wrapped.ListTodo;
export const Loader2 = wrapped.Loader2;
export const Lock = wrapped.Lock;
export const LogIn = wrapped.LogIn;
export const Mail = wrapped.Mail;
export const Maximize2 = wrapped.Maximize2;
export const Menu = wrapped.Menu;
export const MessageCircle = wrapped.MessageCircle;
export const MessageSquare = wrapped.MessageSquare;
export const MessageSquareText = wrapped.MessageSquareText;
export const Mic = wrapped.Mic;
export const MicOff = wrapped.MicOff;
export const Minimize2 = wrapped.Minimize2;
export const Minus = wrapped.Minus;
export const Moon = wrapped.Moon;
export const MoreHorizontal = wrapped.MoreHorizontal;
export const MoreVertical = wrapped.MoreVertical;
export const Network = wrapped.Network;
export const PanelLeftClose = wrapped.PanelLeftClose;
export const PanelLeftOpen = wrapped.PanelLeftOpen;
export const PanelRight = wrapped.PanelRight;
export const Paperclip = wrapped.Paperclip;
export const Pause = wrapped.Pause;
export const PenLine = wrapped.PenLine;
export const Phone = wrapped.Phone;
export const PhoneCall = wrapped.PhoneCall;
export const PhoneOff = wrapped.PhoneOff;
export const Play = wrapped.Play;
export const Plus = wrapped.Plus;
export const Power = wrapped.Power;
export const Redo2 = wrapped.Redo2;
export const RefreshCw = wrapped.RefreshCw;
export const Repeat = wrapped.Repeat;
export const Receipt = wrapped.Receipt;
export const Rocket = wrapped.Rocket;
export const RotateCcw = wrapped.RotateCcw;
export const Save = wrapped.Save;
export const Scale = wrapped.Scale;
export const Search = wrapped.Search;
export const Send = wrapped.Send;
export const Settings = wrapped.Settings;
export const Settings2 = wrapped.Settings2;
export const Share2 = wrapped.Share2;
export const Shield = wrapped.Shield;
export const ShieldAlert = wrapped.ShieldAlert;
export const ShieldCheck = wrapped.ShieldCheck;
export const ShieldMinus = wrapped.ShieldMinus;
export const Sliders = wrapped.Sliders;
export const SlidersHorizontal = wrapped.SlidersHorizontal;
export const Smartphone = wrapped.Smartphone;
export const Smile = wrapped.Smile;
export const Sparkles = wrapped.Sparkles;
export const Square = wrapped.Square;
export const Star = wrapped.Star;
export const Tag = wrapped.Tag;
export const Tags = wrapped.Tags;
export const Target = wrapped.Target;
export const Thermometer = wrapped.Thermometer;
export const Timer = wrapped.Timer;
export const Trash = wrapped.Trash;
export const Trash2 = wrapped.Trash2;
export const TrendingUp = wrapped.TrendingUp;
export const Trophy = wrapped.Trophy;
export const Undo = wrapped.Undo;
export const Undo2 = wrapped.Undo2;
export const Unlock = wrapped.Unlock;
export const Unplug = wrapped.Unplug;
export const UploadCloud = wrapped.UploadCloud;
export const User = wrapped.User;
export const UserCheck = wrapped.UserCheck;
export const UserCircle = wrapped.UserCircle;
export const UserMinus = wrapped.UserMinus;
export const UserPlus = wrapped.UserPlus;
export const UserX = wrapped.UserX;
export const Users = wrapped.Users;
export const Wand2 = wrapped.Wand2;
export const WandSparkles = wrapped.WandSparkles;
export const Waves = wrapped.Waves;
export const Workflow = wrapped.Workflow;
export const Wrench = wrapped.Wrench;
export const X = wrapped.X;
export const XCircle = wrapped.XCircle;
export const Zap = wrapped.Zap;

export const ICONS = wrapped;
export type IconName = keyof typeof wrapped;

export function Icon({
  name,
  size = "md",
  ...props
}: IconProps & { name: IconName }) {
  const Cmp = wrapped[name] as ReturnType<typeof wrap>;
  return <Cmp size={size} {...props} />;
}
