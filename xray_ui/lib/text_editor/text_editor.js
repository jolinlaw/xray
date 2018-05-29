const React = require("react");
const ReactDOM = require("react-dom");
const PropTypes = require("prop-types");
const { styled } = require("styletron-react");
const TextPlane = require("./text_plane");
const debounce = require("../debounce");
const $ = React.createElement;
const { ActionContext, Action } = require("../action_dispatcher");

const CURSOR_BLINK_RESUME_DELAY = 300;
const CURSOR_BLINK_PERIOD = 800;

const Root = styled("div", {
  width: "100%",
  height: "100%",
  overflow: "hidden"
});

class TextEditor extends React.Component {
  static getDerivedStateFromProps(nextProps, prevState) {
    let derivedState = null;

    if (nextProps.width != null && nextProps.width !== prevState.width) {
      derivedState = { width: nextProps.width };
    }

    if (nextProps.height != null && nextProps.height !== prevState.height) {
      if (derivedState) {
        derivedState.height = nextProps.height;
      } else {
        derivedState = { height: nextProps.height };
      }
    }

    return derivedState;
  }

  constructor(props) {
    super(props);
    this.handleMouseWheel = this.handleMouseWheel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.pauseCursorBlinking = this.pauseCursorBlinking.bind(this);
    this.debouncedStartCursorBlinking = debounce(
      this.startCursorBlinking.bind(this),
      CURSOR_BLINK_RESUME_DELAY
    );

    this.state = { scrollLeft: 0, showLocalCursors: true };
  }

  componentDidMount() {
    const element = ReactDOM.findDOMNode(this);
    this.resizeObserver = new ResizeObserver(([{ contentRect }]) => {
      this.componentDidResize({
        width: contentRect.width,
        height: contentRect.height
      });
    });
    this.resizeObserver.observe(element);

    if (this.props.width == null || this.props.height == null) {
      const dimensions = {
        width: element.offsetWidth,
        height: element.offsetHeight
      };
      this.componentDidResize(dimensions);
      this.setState(dimensions);
    }

    element.addEventListener("wheel", this.handleMouseWheel, { passive: true });

    this.startCursorBlinking();
  }

  componentWillUnmount() {
    this.stopCursorBlinking();
    const element = ReactDOM.findDOMNode(this);
    element.removeEventListener("wheel", this.handleMouseWheel, {
      passive: true
    });
    this.resizeObserver.disconnect();
  }

  componentDidResize(measurements) {
    this.props.dispatch({
      type: "SetDimensions",
      width: measurements.width,
      height: measurements.height
    });
  }

  render() {
    this.flushHorizontalAutoscroll();

    return $(
      ActionContext,
      { add: "TextEditor" },
      $(
        Root,
        {
          tabIndex: -1,
          onKeyDown: this.handleKeyDown,
          $ref: element => {
            this.element = element;
          }
        },
        $(TextPlane, {
          showLocalCursors: this.state.showLocalCursors,
          lineHeight: this.props.line_height,
          scrollTop: this.props.scroll_top,
          paddingLeft: 5,
          scrollLeft: this.getScrollLeft(),
          height: this.props.height,
          width: this.getScrollWidth(),
          selections: this.props.selections,
          firstVisibleRow: this.props.first_visible_row,
          totalRowCount: this.props.total_row_count,
          lines: this.props.lines,
          ref: textPlane => {
            this.textPlane = textPlane;
          }
        })
      ),
      $(Action, {
        type: "AddSelectionAbove",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "AddSelectionBelow",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, { type: "SelectUp", onWillDispatch: this.pauseCursorBlinking }),
      $(Action, {
        type: "SelectDown",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "SelectLeft",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "SelectRight",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "SelectToBeginningOfWord",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "SelectToEndOfWord",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, { type: "MoveUp", onWillDispatch: this.pauseCursorBlinking }),
      $(Action, { type: "MoveDown", onWillDispatch: this.pauseCursorBlinking }),
      $(Action, { type: "MoveLeft", onWillDispatch: this.pauseCursorBlinking }),
      $(Action, {
        type: "MoveRight",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "MoveToBeginningOfWord",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "MoveToEndOfWord",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "MoveToBeginningOfLine",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "MoveToEndOfLine",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, {
        type: "Backspace",
        onWillDispatch: this.pauseCursorBlinking
      }),
      $(Action, { type: "Delete", onWillDispatch: this.pauseCursorBlinking })
    );
  }

  handleMouseWheel(event) {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      this.setScrollLeft(this.state.scrollLeft + event.deltaX);
    } else {
      this.props.dispatch({ type: "UpdateScrollTop", delta: event.deltaY });
    }
  }

  handleKeyDown(event) {
    const hasNoModifierKeys = !event.metaKey && !event.ctrlKey && !event.altKey;
    if (event.key.length === 1 && hasNoModifierKeys) {
      this.props.dispatch({ type: "Edit", text: event.key });
    } else if (event.key === "Enter") {
      this.props.dispatch({ type: "Edit", text: "\n" });
    }
  }

  pauseCursorBlinking() {
    this.stopCursorBlinking();
    this.debouncedStartCursorBlinking();
  }

  stopCursorBlinking() {
    if (this.state.cursorsBlinking) {
      window.clearInterval(this.cursorBlinkIntervalHandle);
      this.cursorBlinkIntervalHandle = null;
      this.setState({
        showLocalCursors: true,
        cursorsBlinking: false
      });
    }
  }

  startCursorBlinking() {
    if (!this.state.cursorsBlinking) {
      this.cursorBlinkIntervalHandle = window.setInterval(() => {
        this.setState({ showLocalCursors: !this.state.showLocalCursors });
      }, CURSOR_BLINK_PERIOD / 2);

      this.setState({
        cursorsBlinking: true,
        showLocalCursors: false
      });
    }
  }

  focus() {
    this.element.focus();
  }

  flushHorizontalAutoscroll() {
    const { horizontal_autoscroll, horizontal_margin, width } = this.props;
    const gutterWidth = this.getGutterWidth();
    if (
      horizontal_autoscroll &&
      width &&
      gutterWidth &&
      this.canUseTextPlane()
    ) {
      const desiredScrollLeft = this.textPlane.measureLine(
        horizontal_autoscroll.start_line,
        Math.max(0, horizontal_autoscroll.start.column - horizontal_margin)
      );
      const desiredScrollRight =
        this.textPlane.measureLine(
          horizontal_autoscroll.end_line,
          Math.min(
            horizontal_autoscroll.end_line.length,
            horizontal_autoscroll.end.column + horizontal_margin
          )
        ) + gutterWidth;

      // This function will be called during render, so we avoid calling
      // setState and we manually manipulate this.state instead.
      if (desiredScrollLeft < this.getScrollLeft()) {
        this.state.scrollLeft = this.constrainScrollLeft(desiredScrollLeft);
      }
      if (desiredScrollRight > this.getScrollRight()) {
        this.state.scrollLeft = this.constrainScrollLeft(
          desiredScrollRight - width
        );
      }

      this.props.horizontal_autoscroll = null;
    }
  }

  getScrollLeft() {
    return this.constrainScrollLeft(this.state.scrollLeft);
  }

  getScrollRight() {
    if (this.props.width) {
      return this.getScrollLeft() + this.props.width;
    } else {
      return this.getScrollLeft();
    }
  }

  setScrollLeft(scrollLeft) {
    this.setState({
      scrollLeft: this.constrainScrollLeft(scrollLeft)
    });
  }

  constrainScrollLeft(scrollLeft) {
    return Math.max(0, Math.min(scrollLeft, this.getMaxScrollLeft()));
  }

  getMaxScrollLeft() {
    const contentWidth = this.getContentWidth();
    if (contentWidth != null && this.props.width != null) {
      return Math.max(0, contentWidth - this.props.width);
    } else {
      return 0;
    }
  }

  getScrollWidth() {
    const contentWidth = this.getContentWidth();
    if (contentWidth != null && this.props.width != null) {
      return Math.max(contentWidth, this.props.width);
    } else {
      return 0;
    }
  }

  getContentWidth() {
    const longestLineWidth = this.getLongestLineWidth();
    const cursorWidth = this.getCursorWidth();
    const gutterWidth = this.getGutterWidth();
    if (
      longestLineWidth != null &&
      cursorWidth != null &&
      gutterWidth != null
    ) {
      return Math.ceil(gutterWidth + longestLineWidth + cursorWidth);
    } else {
      return null;
    }
  }

  getCursorWidth() {
    if (this.cursorWidth == null && this.canUseTextPlane()) {
      this.cursorWidth = this.textPlane.measureLine("X");
    }
    return this.cursorWidth;
  }

  getLongestLineWidth() {
    const { longest_line: longestLine } = this.props;
    if (this.longestLine != longestLine && this.canUseTextPlane()) {
      this.longestLine = longestLine;
      this.longestLineWidth = this.textPlane.measureLine(longestLine);
    }
    return this.longestLineWidth;
  }

  getGutterWidth() {
    if (this.canUseTextPlane()) {
      return this.textPlane.getGutterWidth(this.props.total_row_count);
    } else {
      return null;
    }
  }

  canUseTextPlane() {
    return this.textPlane && this.textPlane.isReady();
  }
}

TextEditor.contextTypes = {
  theme: PropTypes.object
};

module.exports = TextEditor;
