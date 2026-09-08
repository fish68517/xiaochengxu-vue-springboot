import { createSSRApp } from 'vue';
import App from './App.vue';
import AdminShell from './components/AdminShell.vue';
import PageHeader from './components/PageHeader.vue';
import FilterBar from './components/FilterBar.vue';
import DataTable from './components/DataTable.vue';
import DetailDrawer from './components/DetailDrawer.vue';
import Pagination from './components/Pagination.vue';
export function createApp() {
  const app = createSSRApp(App);
  app.component('AdminShell', AdminShell);
  app.component('PageHeader', PageHeader);
  app.component('FilterBar', FilterBar);
  app.component('DataTable', DataTable);
  app.component('DetailDrawer', DetailDrawer);
  app.component('Pagination', Pagination);
  return { app };
}
