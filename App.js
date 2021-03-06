import React, { Fragment } from 'react'
import { Constants, Location, Permissions, Haptic } from 'expo'
import { StyleSheet, Text, View } from 'react-native'
import Places from 'google-places-web'
import { LatLonSpherical as Geo } from 'geodesy'
import { Ionicons } from '@expo/vector-icons'
import Shake from './shake'

Places.apiKey = Constants.manifest.extra.places_api_key
Places.debug = process.env.NODE_ENV !== 'production'

export default class App extends React.Component {
  constructor() {
    super()
    this.shake = new Shake()
    this.state = {
      message: 'Coffee. Now.',
      target: null,
      trueHeading: 0,
      bearing: 0,
    }
  }

  componentDidMount = async () => {
    // Watch for shake event
    this.shake.start(async () => {
      Haptic.notification(Haptic.NotificationTypes.Success)
      this._onComplete()

      const startLocation = await this._getLocation()
      await this._getTarget(startLocation, { random: true })
    })

    const allowed = await this._getPermish()
    if (allowed) {
      const startLocation = await this._getLocation()
      await this._getTarget(startLocation)
      this._watch()
    } else {
      this.setState({
        message: 'Cant do anything without location permissions',
      })
    }
  }

  componentWillUnmount() {
    this.shake.stop()
  }

  _getTarget = async (location, { random } = { random: false }) => {
    if (random) {
      this.setState({ message: 'Oh, you crazy.' })
    } else {
      this.setState({ message: 'Coffee.\n Now.' })
    }
    try {
      let places = await Places.nearbysearch({
        location: `${location.coords.latitude},${location.coords.longitude}`,
        rankby: 'distance',
        opennow: true,
        type: ['cafe'],
      })

      const i = random ? Math.floor(Math.random() * places.length) : 0
      this.setState({
        target: places[i],
        message: null,
      })
    } catch (err) {
      this.setState({ message: err.message })
    }
  }

  _getPermish = async () => {
    let { status } = await Permissions.askAsync(Permissions.LOCATION)
    if (status == 'granted') {
      return true
    }
    return false
  }

  _getLocation = async () => {
    return Expo.Location.getCurrentPositionAsync({ enableHighAccuracy: true })
  }

  _watch = async () => {
    // watch location & heading
    Location.watchPositionAsync(
      { enableHighAccuracy: true, distanceInterval: 1 },
      location => {
        this.setState({ location: location }, () => {
          this._getBearing(location.heading)
          this._areWeThereYet()
        })
      },
    )

    Location.watchHeadingAsync(({ trueHeading }) => {
      if (this.state.location && this.state.target) {
        this._getBearing(trueHeading)
      }
    })
  }

  _getBearing(trueHeading) {
    // get bearing & distance
    const { location, target } = this.state
    const latLng = new Geo(location.coords.latitude, location.coords.longitude)

    const targetLocale = target.geometry.location
    const to = new Geo(targetLocale.lat, targetLocale.lng)
    const bearing = latLng.bearingTo(to)

    this.setState({
      bearing: bearing - trueHeading,
      distance: latLng.distanceTo(to),
    })

    return bearing
  }

  _areWeThereYet() {
    if (this.state.distance < 10) {
      this.setState({ message: 'Enjoy!' })
      this._onComplete()
    }
  }

  _onComplete() {
    this.setState(
      {
        target: null,
      },
      () => {
        Haptic.notification(Haptic.NotificationTypes.Success)
      },
    )
  }

  _style() {
    return StyleSheet.create({
      arrow: {
        transform: [{ rotateZ: `${this.state.bearing}deg` }],
      },
    })
  }

  render() {
    const { message, target, distance } = this.state
    return (
      <View style={styles.container}>
        {!message &&
          target && (
            <Fragment>
              <Text style={styles.title}>{target.name.toUpperCase()}</Text>
              <Text style={styles.meta}>{Math.floor(distance)}m</Text>
              <Ionicons
                style={this._style().arrow}
                name="md-arrow-up"
                size={500}
              />
            </Fragment>
          )}
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontWeight: 'bold',
    fontSize: 30,
  },
  title: {
    marginTop: 25,
    fontWeight: 'bold',
    fontSize: 25,
  },
  meta: {
    fontWeight: 'bold',
    fontSize: 15,
  },
}
