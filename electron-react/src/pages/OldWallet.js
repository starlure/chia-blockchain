import React, { Component }  from 'react';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { withTheme } from '@material-ui/styles';
import Container from '@material-ui/core/Container';
import ArrowBackIosIcon from '@material-ui/icons/ArrowBackIos';
import { connect, useSelector } from 'react-redux';
import { withRouter, Redirect } from 'react-router-dom'
import CssTextField from '../components/cssTextField'
import myStyle from './style'
import { useStore , useDispatch} from 'react-redux'
import {mnemonic_word_added} from '../modules/mnemonic_input'
import { log_in } from '../modules/message';

const MnemonicField = (props) => {
    return (
      <Grid item xs={2}>
        <CssTextField
        variant="outlined"
        margin="normal"
        fullWidth
        color="primary" 
        id={props.id}
        label={props.index}
        autoFocus={props.autofocus}
        defaultValue=""
        onChange={props.onChange}
        />
      </Grid>
    )
}

const Iterator = (props) => {
    const store = useStore()
    const dispatch = useDispatch()

    function handleTextFieldChange(e) {
        console.log(e.target)
        console.log(store)
        var id = e.target.id + ""
        var clean_id = id.replace("id_", "");
        var int_val = parseInt(clean_id) - 1
        var data = {"word": e.target.value, "id": int_val}
        dispatch(mnemonic_word_added(data))
    }
    var indents = [];
    for (var i = 0; i < 24; i++) {
      var focus = i === 0
      indents.push(<MnemonicField onChange={handleTextFieldChange} key={i} autofocus={focus} id={"id_"+(i+1)} index={i+1} />);
    }
    return indents;
}

const UIPart = (props) => {
    function goBack(){
        props.props.history.goBack();
    }
    const store = useStore()
    const dispatch = useDispatch()

    function enterMnemonic(){
        var state = store.getState()
        var mnemonic = state.mnemonic_state.mnemonic_input
        dispatch(log_in(mnemonic))
    }
    const logged_in = useSelector(state => state.wallet_state.logged_in)
    const words = useSelector(state => state.wallet_state.mnemonic)
    const classes = myStyle();
    if (logged_in) {
        console.log("Redirecting to wallet")
        return (<Redirect to="/dashboard" />)
    } 
    return(
      <div className={classes.root}>
      <Link onClick={goBack} href="#" variant="">
        <ArrowBackIosIcon className={classes.navigator}> </ArrowBackIosIcon>
      </Link>
      <div className={classes.grid_wrap}>
      <Container className={classes.grid} maxWidth="lg">
          <Typography className={classes.title} component="h1" variant="h5">
            Enter Your Mnemonics
          </Typography>
          <Grid container spacing={2}>
            <Iterator mnemonic={words}></Iterator>
          </Grid>
      </Container>
      </div>
      <Container component="main" maxWidth="xs" >
        <CssBaseline />
        <div className={classes.paper}>
            <Button
              onClick={enterMnemonic} 
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              className={classes.submit}
            >
              Next
            </Button>
        </div>
      </Container>
      </div>
    )
  }


class OldWallet extends Component {
    constructor(props) {
        super(props);
        this.words = []
        this.classes = props.theme
      }
    
    
    componentDidMount(props) {
        console.log("Input Mnemonic")
    }
  
    render() {
        return(<UIPart props={this.props}></UIPart>)
    }
  }


export default withTheme(withRouter(connect()(OldWallet)));