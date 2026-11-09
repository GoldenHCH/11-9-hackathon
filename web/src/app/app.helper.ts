import { staffRoutes } from './app.constants';
import { RoleView } from './app.types';

export class AppHelper {
  public static roleForUrl(url: string): RoleView {
    const path = url.split(/[?#]/)[0] ?? '';
    const staff = staffRoutes.find((route) => path === route.path || path.startsWith(`${route.path}/`));

    return staff?.role ?? 'attendee';
  }
}
