import React from 'react';
import activity from '../../../bootstrap-icons-1.13.2/activity.svg?url';
import barChart from '../../../bootstrap-icons-1.13.2/bar-chart-line.svg?url';
import bell from '../../../bootstrap-icons-1.13.2/bell.svg?url';
import wrench from '../../../bootstrap-icons-1.13.2/wrench-adjustable.svg?url';
import building from '../../../bootstrap-icons-1.13.2/building.svg?url';
import calendar from '../../../bootstrap-icons-1.13.2/calendar3.svg?url';
import chat from '../../../bootstrap-icons-1.13.2/chat-dots.svg?url';
import cash from '../../../bootstrap-icons-1.13.2/cash-coin.svg?url';
import check from '../../../bootstrap-icons-1.13.2/check-circle-fill.svg?url';
import clock from '../../../bootstrap-icons-1.13.2/clock-history.svg?url';
import creditCard from '../../../bootstrap-icons-1.13.2/credit-card.svg?url';
import door from '../../../bootstrap-icons-1.13.2/door-open.svg?url';
import envelope from '../../../bootstrap-icons-1.13.2/envelope-paper.svg?url';
import gear from '../../../bootstrap-icons-1.13.2/gear.svg?url';
import geo from '../../../bootstrap-icons-1.13.2/geo-alt.svg?url';
import graphUp from '../../../bootstrap-icons-1.13.2/graph-up-arrow.svg?url';
import heart from '../../../bootstrap-icons-1.13.2/heart.svg?url';
import house from '../../../bootstrap-icons-1.13.2/house-fill.svg?url';
import hourglass from '../../../bootstrap-icons-1.13.2/hourglass-split.svg?url';
import image from '../../../bootstrap-icons-1.13.2/image.svg?url';
import lightbulb from '../../../bootstrap-icons-1.13.2/lightbulb.svg?url';
import lightning from '../../../bootstrap-icons-1.13.2/lightning-charge.svg?url';
import list from '../../../bootstrap-icons-1.13.2/list.svg?url';
import people from '../../../bootstrap-icons-1.13.2/people-fill.svg?url';
import person from '../../../bootstrap-icons-1.13.2/person-circle.svg?url';
import personGear from '../../../bootstrap-icons-1.13.2/person-gear.svg?url';
import search from '../../../bootstrap-icons-1.13.2/search.svg?url';
import shield from '../../../bootstrap-icons-1.13.2/shield-check.svg?url';
import stars from '../../../bootstrap-icons-1.13.2/stars.svg?url';
import warning from '../../../bootstrap-icons-1.13.2/exclamation-triangle-fill.svg?url';
import xCircle from '../../../bootstrap-icons-1.13.2/x-circle-fill.svg?url';

const icons: Record<string, string> = {
  activity, 'bar-chart': barChart, bell, building, calendar, cash, chat, check, clock,
  'credit-card': creditCard, door, envelope, gear, 'graph-up': graphUp, heart, house, hourglass,
  geo, image, lightbulb, lightning, list, people, person, 'person-gear': personGear,
  search, shield, stars, warning, wrench, 'x-circle': xCircle,
};

interface BootstrapIconProps {
  name: string;
  className?: string;
}

/** Uses the project's local Bootstrap Icons SVG assets as currentColor masks. */
export const BootstrapIcon: React.FC<BootstrapIconProps> = ({ name, className = '' }) => {
  const url = icons[name];
  if (!url) return null;
  return <span className={`bootstrap-icon ${className}`.trim()} style={{ maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` }} aria-hidden="true" />;
};
