import gql from "graphql-tag";
import { Query } from "react-apollo";
import { Fragment } from "react";
import {
  Card,
  Stack,
  DataTable,
  Thumbnail,
  Checkbox,
  Button,
  Filters,
  SkeletonBodyText,
  Tooltip,
  SettingToggle,
  TextStyle,
  Pagination,
  TextField,
  Modal,
  Banner,
  Toast,
  Select,
} from "@shopify/polaris";
import { Redirect } from "@shopify/app-bridge/actions";
import { Context, Loading } from "@shopify/app-bridge-react";
import axios from "axios";

const GET_PRODUCTS = gql`
  query getProducts(
    $query: String
    $sortKey: ProductSortKeys!
    $reverse: Boolean
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    products(
      query: $query
      sortKey: $sortKey
      reverse: $reverse
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        node {
          id
          title
          descriptionHtml
          productType
          vendor
          totalInventory
          totalVariants
          tags
          images(first: 1) {
            edges {
              node {
                originalSrc
                altText
              }
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

class ProductsTable extends React.Component {
  static contextType = Context;

  constructor(props) {
    super(props);
    this.state =
      this.props.state != null
        ? this.props.state
        : {
          selectedItems: [],
          queryValue: null,
          query: null,
          sortKey: "TITLE",
          reverse: false,
          sortDirection: "ascending",
          sortColumnIndex: 2,
          showDescriptions: true,
          first: 5,
          after: null,
          last: null,
          before: null,
          email: "",
          emailSent: false,
          showModal: false,
          schedule: "* * * * *", // Default to hourly
        };
    this.queryTimerID = null;
  }

  handleEmailInputChange = (value) => {
    this.setState({ email: value });
  };

  sendEmailNotification = async () => {
    const { email } = this.state;
    const productsOutOfStock = this.products.filter(
      (product) => product.totalInventory === 0
    );
    if (productsOutOfStock.length > 0 && email) {
      try {
        await axios.post("/api/send-email", {
          email,
          products: productsOutOfStock,
        });
        this.setState({ emailSent: true });
      } catch (error) {
        console.error("Error sending email:", error);
      }
    } else {
      console.log("No out-of-stock products or email not provided", email, this.products);
      this.setState({ emailSent: false });
    }
  };

  handleScheduleChange = (value) => {
    this.setState({ schedule: value });
  };

  setEmailSchedule = async () => {
    const { email, schedule } = this.state;
    const productsOutOfStock = this.products.filter(
      (product) => product.totalInventory === 0
    );
    if (productsOutOfStock.length > 0 && email && schedule) {
      try {
        await axios.post("/api/schedule-email", {
          email,
          products: productsOutOfStock,
          schedule,
        });
        this.setState({ emailSent: true });
      } catch (error) {
        console.error("Error setting email schedule:", error);
      }
    }
  };

  updateProductQuery = () => {
    this.setState({ query: this.state.queryValue });
  };

  handleQueryChange = (value) => {
    if (this.queryTimerID != null) {
      clearTimeout(this.queryTimerID);
      this.queryTimerID = null;
    }
    this.queryTimerID = setTimeout(() => {
      this.queryTimerID = null;
      this.updateProductQuery();
    }, 500);
    this.setState({ queryValue: value });
  };

  clearQuery = () => {
    this.setState({ queryValue: null });
    setTimeout(() => this.updateProductQuery(), 100);
  };

  handleSortChange = (index, direction) => {
    let sortKey = "TITLE";
    switch (index) {
      case 3:
        sortKey = "INVENTORY_TOTAL";
        break;
      case 4:
        sortKey = "PRODUCT_TYPE";
        break;
      case 5:
        sortKey = "VENDOR";
        break;
      default:
        sortKey = "TITLE";
    }
    const reverse = direction === "descending";
    this.setState({
      sortKey: sortKey,
      reverse: reverse,
      sortColumnIndex: index,
      sortDirection: direction,
    });
  };

  toggleProductSelection = (isSelected, id) => {
    this.setState((prevState) => ({
      selectedItems: isSelected
        ? prevState.selectedItems.concat([id])
        : prevState.selectedItems.filter((item) => item !== id),
    }));
  };

  selectAllProducts = (isSelected) => {
    this.setState({
      selectedItems: isSelected
        ? this.products.map((product) => product.id)
        : [],
    });
  };

  toggleDescriptions = () => {
    this.setState({ showDescriptions: !this.state.showDescriptions });
  };

  redirectToProduct = (gid) => {
    const app = this.context;
    const redirect = Redirect.create(app);
    const id = gid.substring(gid.lastIndexOf("/") + 1);
    redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
      name: Redirect.ResourceType.Product,
      resource: { id },
    });
  };

  renderLoadingState = () => (
    <Fragment>
      <Loading />
      <Card.Section>
        <SkeletonBodyText lines={2} />
      </Card.Section>
      <Card.Section>
        <SkeletonBodyText lines={2} />
      </Card.Section>
      <Card.Section>
        <SkeletonBodyText lines={2} />
      </Card.Section>
    </Fragment>
  );

  renderTable = (rows, descriptions) => (
    <div className="data-table">
      <SettingToggle
        action={{
          content: this.state.showDescriptions
            ? "Hide Descriptions"
            : "Show Descriptions",
          onAction: this.toggleDescriptions,
        }}
        enabled={this.state.showDescriptions}
      >
        {this.state.selectedItems.length === 0
          ? `Showing ${descriptions.length} ${descriptions.length > 1 ? "products" : "product"
          }.`
          : `${this.state.selectedItems.length} of ${descriptions.length} ${descriptions.length > 1 ? "products" : "product"
          } selected.`}
        <br />
        Product descriptions are{" "}
        {this.state.showDescriptions
          ? "being displayed below each product row"
          : "hidden"}
        .
      </SettingToggle>
      <DataTableWithProductDescription
        columnContentTypes={[
          "text",
          "text",
          "text",
          "text",
          "text",
          "text",
          "text",
        ]}
        headings={[
          <Tooltip content="Select all products" preferredPosition="above">
            <Button
              size="slim"
              disclosure
              onClick={() =>
                this.selectAllProducts(
                  !(this.state.selectedItems.length === this.products.length)
                )
              }
            >
              <Checkbox
                label="Select all Products"
                labelHidden={true}
                id="selectAllProducts"
                checked={this.areAllProductsSelected()}
                onChange={this.selectAllProducts}
              />
            </Button>
          </Tooltip>,
          "",
          "Product",
          "Inventory",
          "Type",
          "Vendor",
          "Tags",
        ]}
        rows={rows}
        descriptions={descriptions}
        verticalAlign="middle"
        sortable={[false, false, true, true, true, true, false]}
        defaultSortDirection={this.state.sortDirection}
        initialSortColumnIndex={this.state.sortColumnIndex}
        showDescriptions={this.state.showDescriptions}
        onSort={this.handleSortChange}
      />
    </div>
  );

  areAllProductsSelected = () => {
    if (this.state.selectedItems.length === 0) {
      return false;
    } else if (this.state.selectedItems.length === this.products.length) {
      return true;
    } else {
      return "indeterminate";
    }
  };

  render() {
    const { schedule, email, emailSent } = this.state;

    return (
      <Card>
        <Card.Section>
          <Filters
            queryValue={this.state.queryValue}
            filters={[]}
            onQueryChange={this.handleQueryChange}
            onQueryClear={this.clearQuery}
          />
        </Card.Section>
        <Card.Section>
          <TextField
            label="Notification Email"
            value={email}
            onChange={this.handleEmailInputChange}
            type="email"
            placeholder="Enter email to receive notifications"
          />
          <Select
            label="Schedule"
            options={[
              { label: "Minutes", value: "* * * * *" },
              { label: "Hourly", value: "0 * * * *" },
              { label: "Daily", value: "0 0 * * *" },
              { label: "Weekly", value: "0 0 * * 0" },
            ]}
            value={schedule}
            onChange={this.handleScheduleChange}
          />
          <Button onClick={this.setEmailSchedule} primary>
            Set Schedule
          </Button>
          {emailSent ? (
            <Banner
              title="Schedule Set"
              status="success"
              onDismiss={() => this.setState({ emailSent: false })}
            >
              <p>Email schedule has been set successfully.</p>
            </Banner>
          ) : (
            <Banner
              title="Error"
              status="critical"
              onDismiss={() => this.setState({ emailSent: false })}
            >
              <p>No products found out of stock.</p>
            </Banner>
          )}
        </Card.Section>
        <Query
          query={GET_PRODUCTS}
          variables={{
            query: this.state.query,
            sortKey: this.state.sortKey,
            reverse: this.state.reverse,
            first: this.state.first,
            after: this.state.after,
            last: this.state.last,
            before: this.state.before,
          }}
        >
          {({ data, loading, error, fetchMore }) => {
            if (loading) return this.renderLoadingState();
            if (error) {
              console.log(error);
              return <div>{error.message}</div>;
            }
            this.products = data.products.edges.map((edge) => edge.node);
            const rows = this.products.map((product) => [
              <Checkbox
                label={`Select ${product.title}`}
                labelHidden={true}
                id={product.id}
                checked={this.state.selectedItems.includes(product.id)}
                onChange={this.toggleProductSelection}
              />,
              <Thumbnail
                source={
                  product.images.edges[0]
                    ? product.images.edges[0].node.originalSrc
                    : ""
                }
                alt={
                  product.images.edges[0]
                    ? product.images.edges[0].node.altText
                    : ""
                }
                size="large"
              />,
              <Button plain onClick={() => this.redirectToProduct(product.id)}>
                <TextStyle variation="strong">{product.title}</TextStyle>
              </Button>,
              <span>
                {product.totalInventory > 0 ? (
                  product.totalInventory
                ) : (
                  <TextStyle variation="negative">
                    {product.totalInventory}
                  </TextStyle>
                )}{" "}
                in stock
                {product.totalVariants > 1
                  ? ` for ${product.totalVariants} variants`
                  : null}
              </span>,
              product.productType,
              product.vendor,
              product.tags.length > 0 ? product.tags.join(", ") : "",
            ]);
            const descriptions = this.products.map(
              (product) => product.descriptionHtml
            );
            return (
              <Fragment>
                {this.renderTable(rows, descriptions)}
                <Pagination
                  hasNext={data.products.pageInfo.hasNextPage}
                  hasPrevious={data.products.pageInfo.hasPreviousPage}
                  onNext={() => {
                    this.setState(
                      {
                        after: data.products.pageInfo.endCursor,
                        before: null,
                        last: null,
                        first: 5,
                      },
                      () => {
                        fetchMore({
                          variables: {
                            after: data.products.pageInfo.endCursor,
                            first: 5,
                          },
                          updateQuery: (prevResult, { fetchMoreResult }) =>
                            fetchMoreResult ? fetchMoreResult : prevResult,
                        });
                      }
                    );
                  }}
                  onPrevious={() => {
                    this.setState(
                      {
                        before: data.products.pageInfo.startCursor,
                        after: null,
                        last: 5,
                        first: null,
                      },
                      () => {
                        fetchMore({
                          variables: {
                            before: data.products.pageInfo.startCursor,
                            last: 5,
                          },
                          updateQuery: (prevResult, { fetchMoreResult }) =>
                            fetchMoreResult ? fetchMoreResult : prevResult,
                        });
                      }
                    );
                  }}
                />
              </Fragment>
            );
          }}
        </Query>
      </Card>
    );
  }
}

function DataTableWithProductDescription(props) {
  const DataTableInner = DataTable(props).type;
  const table = new DataTableInner(props);
  const parentDefaultRenderRow = table.defaultRenderRow;
  table.defaultRenderRow = (row, index) => {
    const defaultRow = parentDefaultRenderRow(row, index);
    const descriptionRow = table.props.showDescriptions && (
      <tr key={`row-${index}-desc`} className="Polaris-DataTable__TableRow" style={{ border: '3px solid black' }}>
        <td
          key={`row-${index}-desc-col-1`}
          className="Polaris-DataTable__Cell Polaris-DataTable__Cell--verticalAlignMiddle"
        ></td>
        <td
          key={`row-${index}-desc-col-2`}
          className="Polaris-DataTable__Cell Polaris-DataTable__Cell--verticalAlignMiddle"
        ></td>
        <td
          key={`row-${index}-desc-col-3`}
          className="Polaris-DataTable__Cell Polaris-DataTable__Cell--verticalAlignMiddle"
          colSpan={row.length - 2}
        >
          <div
            dangerouslySetInnerHTML={{
              __html: table.props.descriptions[index],
            }}
          />
        </td>
      </tr>
    );
    return (
      <Fragment key={`frag-${index}-desc`}>
        {defaultRow}
        {descriptionRow}
      </Fragment>
    );
  };
  return table;
}

export default ProductsTable;
