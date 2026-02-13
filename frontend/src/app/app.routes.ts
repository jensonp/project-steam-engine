import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () => {
            return import('./pages/query-screen/query-screen').then(m => m.QueryScreen);
        },
        title: 'Steam Games Recommender'
    },
    {
        path: 'results',
        pathMatch: 'full',
        loadComponent: () => {
            return import('./pages/result-screen/result-screen').then(m => m.ResultScreen);
        },
        title: 'Recommendations'
    },
    {
        path: 'config',
        pathMatch: 'full',
        loadComponent: () => {
            return import('./pages/config-screen/config-screen').then(m => m.ConfigScreen);
        },
        title: 'Configurations'
    }
];
