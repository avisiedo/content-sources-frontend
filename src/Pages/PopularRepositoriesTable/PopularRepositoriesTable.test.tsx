import { render } from '@testing-library/react';
import {
  ReactQueryTestWrapper,
  defaultPopularRepository,
  testRepositoryParamsResponse,
} from '../../testingHelpers';
import PopularRepositoriesTable from './PopularRepositoriesTable';
import {
  usePopularRepositoriesQuery,
  useRepositoryParams,
} from '../../services/Content/ContentQueries';

jest.mock('../../services/Content/ContentQueries', () => ({
  useRepositoryParams: jest.fn(),
  usePopularRepositoriesQuery: jest.fn(),
  useAddPopularRepositoryQuery: () => ({ isLoading: false }),
  useDeletePopularRepositoryMutate: () => ({ isLoading: false }),
  useFetchGpgKey: () => ({ fetchGpgKey: () => '' }),
}));

jest.mock('../../middleware/AppContext', () => ({
  useAppContext: () => ({}),
}));

it('expect PopularRepositoriesTable to render with one item', () => {
  (useRepositoryParams as jest.Mock).mockImplementation(() => ({ isLoading: false }));
  (usePopularRepositoriesQuery as jest.Mock).mockImplementation(() => ({
    isLoading: false,
    data: { data: [defaultPopularRepository], meta: { count: 1, limit: 20, offset: 0 } },
  }));

  const { queryByText } = render(
    <ReactQueryTestWrapper>
      <PopularRepositoriesTable />
    </ReactQueryTestWrapper>,
  );

  expect(queryByText(defaultPopularRepository.suggested_name)).toBeInTheDocument();
  expect(queryByText(defaultPopularRepository.url)).toBeInTheDocument();
  expect(queryByText('Add')).toBeInTheDocument();
});

it('expect PopularRepositoriesTable to render with one item', () => {
  (useRepositoryParams as jest.Mock).mockImplementation(() => ({ isLoading: false }));
  (usePopularRepositoriesQuery as jest.Mock).mockImplementation(() => ({
    isLoading: false,
    data: {
      data: [{ ...defaultPopularRepository, uuid: 'ifThisExistsThanButtonIsRemove' }],
      meta: { count: 1, limit: 20, offset: 0 },
    },
  }));

  const { queryByText } = render(
    <ReactQueryTestWrapper>
      <PopularRepositoriesTable />
    </ReactQueryTestWrapper>,
  );

  expect(queryByText(defaultPopularRepository.suggested_name)).toBeInTheDocument();
  expect(queryByText(defaultPopularRepository.url)).toBeInTheDocument();
  expect(queryByText('Remove')).toBeInTheDocument();
});

it('Render a loading state checking search disabled', () => {
  (useRepositoryParams as jest.Mock).mockImplementation(() => ({
    isLoading: false,
    data: testRepositoryParamsResponse,
  }));
  (usePopularRepositoriesQuery as jest.Mock).mockImplementation(() => ({
    isLoading: true,
  }));

  const { queryByPlaceholderText } = render(
    <ReactQueryTestWrapper>
      <PopularRepositoriesTable />
    </ReactQueryTestWrapper>,
  );

  expect(queryByPlaceholderText('Filter by name/url')).toHaveAttribute('disabled');
});
