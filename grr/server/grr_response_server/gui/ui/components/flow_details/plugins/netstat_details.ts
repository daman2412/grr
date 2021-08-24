import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormControl} from '@angular/forms';
import {HttpApiService} from '@app/lib/api/http_api_service';
import {FlowState} from '@app/lib/models/flow';
import {combineLatest, Observable, of} from 'rxjs';
import {map, startWith} from 'rxjs/operators';

import {NetstatArgs, NetworkConnection} from '../../../lib/api/api_interfaces';
import {FlowResultsLocalStore} from '../../../store/flow_results_local_store';

import {Plugin} from './plugin';

const INITIAL_RESULT_COUNT = 1000;

const COLUMNS: ReadonlyArray<string> = [
  'pid',
  'processName',
  'state',
  'type',
  'family',
  'localIP',
  'localPort',
  'remoteIP',
  'remotePort',
];

/**
 * Component that displays the details (results) for a
 * particular Netstat Flow.
 */
@Component({
  selector: 'netstat-details',
  templateUrl: './netstat_details.ng.html',
  styleUrls: ['./netstat_details.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetstatDetails extends Plugin {
  constructor(
      private readonly flowResultsLocalStore: FlowResultsLocalStore,
      private readonly httpApiService: HttpApiService,
  ) {
    super();
    this.flowResultsLocalStore.query(
        this.flow$.pipe(map(flow => ({flow, withType: 'NetworkConnection'}))));
  }

  displayedColumns$: Observable<ReadonlyArray<string>> = of(COLUMNS);

  readonly netstatResults$: Observable<NetworkConnection[]> =
      this.flowResultsLocalStore.results$.pipe(
          map(results =>
                  results?.map((data) => data.payload as NetworkConnection)));

  readonly searchStringControl = new FormControl('');

  readonly filteredResults$: Observable<ReadonlyArray<NetworkConnection>> =
      combineLatest([
        this.netstatResults$,
        this.searchStringControl.valueChanges.pipe(
            startWith(''), map(str => str.toLowerCase()))
      ])
          .pipe(map(
              ([results, searchString]) => results.filter(
                  result => isSubstring(result.processName, searchString) ||
                      isSubstring(result.localAddress?.ip, searchString) ||
                      isSubstring(result.remoteAddress?.ip, searchString))));

  readonly FINISHED = FlowState.FINISHED;

  readonly flowState$: Observable<FlowState> = this.flow$.pipe(
      map((flow) => flow.state),
  );

  // TODO: Prepopulate resultMetadata for all flows or stop relying
  // on it here. resultMetadata is not populated for old flows, so we shouldn't
  // rely in it here as is, as we can display wrong information.
  readonly progressCount$ = this.flow$.pipe(
      map(flow => flow.resultCounts),
      map(resultCounts => resultCounts?.find(
              resultCount => resultCount.type === 'NetworkConnection')),
      map(resultCount => resultCount?.count),
  );
  private readonly flowArgs$ =
      this.flow$.pipe(map(flow => flow.args as NetstatArgs));

  readonly title$ = this.flowArgs$.pipe(map(args => {
    if (args.listeningOnly) {
      return 'Listening only';
    } else {
      return 'All connections';
    }
  }));

  readonly archiveUrl$: Observable<string> = this.flow$.pipe(map((flow) => {
    return this.httpApiService.getExportedResultsCsvUrl(
        flow.clientId, flow.flowId);
  }));

  readonly archiveFileName$: Observable<string> =
      this.flow$.pipe(map((flow) => {
        return flow.clientId.replace('.', '_') + '_' + flow.flowId + '.zip';
      }));

  onShowClicked() {
    this.flowResultsLocalStore.queryMore(INITIAL_RESULT_COUNT);
  }

  trackByConnectionRowIndex(index: number, item: NetworkConnection) {
    return index;
  }
}

function isSubstring(text: string|undefined, substring: string): boolean {
  return text?.toLowerCase().includes(substring) ?? false;
}
