import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import { Storage } from '@ionic/storage-angular';

import { RIVE_FOLDER } from 'ng-rive';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';
import { APP_INITIALIZER } from '@angular/core';
import { SqliteService } from './app/services/sqlite.service';
import { LogService } from './app/services/log.service';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHighcharts } from 'highcharts-angular';
import { AiSeedService } from './app/services/ai-seed.service';

addIcons(allIcons);

const storage = new Storage(); // create instance

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(), provideHighcharts(), 
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({
      mode: 'md',
      tabButtonLayout: 'icon-top',
    }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: RIVE_FOLDER, useValue: 'assets/course_rive/rive' },
    { provide: Storage, useValue: storage },

    // Initialize SQLite
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [SqliteService, LogService, AiSeedService],
      useFactory: (
        db: SqliteService,
        log: LogService,
        aiSeedService: AiSeedService
      ) => {
        return async () => {
          await db.initdb(); // initialize SQLite
          await db.initializeDatabase();
          await aiSeedService.seedIfNeeded();
          await log.log('App started and database initialized'); // log startup
        };
      },
    },
    FileOpener,
  ],
});
