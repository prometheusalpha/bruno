import styled from 'styled-components';
import { rgba } from 'polished';

const Wrapper = styled.div`
  .jwt-details {
    border: 1px solid ${(props) => props.theme.table.border};
    border-radius: 4px;
    max-width: 400px;
    overflow: hidden;
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .jwt-details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px;
    cursor: pointer;
    color: ${(props) => props.theme.colors.text.subtext1};

    span {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .table-wrapper {
    border-top: 1px solid ${(props) => props.theme.table.border};
  }

  table {
    width: 100%;
    border-collapse: collapse;

    thead {
      color: ${(props) => props.theme.table.thead.color};
      font-size: ${(props) => props.theme.font.size.sm};
      font-weight: 500;

      td {
        border-top: none;
      }
    }

    td {
      border: 1px solid ${(props) => props.theme.table.border};
      padding: 4px 8px;

      &:first-child {
        border-left: none;
        white-space: nowrap;
      }

      &:last-child {
        border-right: none;
      }

      &.value {
        word-break: break-all;
      }
    }

    tbody {
      tr:nth-child(odd) {
        background-color: ${(props) => props.theme.table.striped};
      }

      tr:last-child td {
        border-bottom: none;
      }
    }
  }

  .jwt-claim-value {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .jwt-copy-button {
    flex-shrink: 0;
    padding: 2px;
    border-radius: 3px;
    background-color: ${(props) => rgba(props.theme.primary.solid, 0.1)};

    &:hover {
      background-color: ${(props) => rgba(props.theme.primary.solid, 0.2)};
    }
  }
`;

export default Wrapper;
