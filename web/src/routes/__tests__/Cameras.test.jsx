import { h } from 'preact';
import * as CameraImage from '../../components/CameraImage';
import * as Mqtt from '../../api/mqtt';
import Cameras from '../Cameras';
import { fireEvent, render, screen, waitForElementToBeRemoved } from 'testing-library';

describe('Cameras Route', () => {
  beforeEach(() => {
    jest.spyOn(CameraImage, 'default').mockImplementation(() => <div data-testid="camera-image" />);
    jest.spyOn(Mqtt, 'useMqtt').mockImplementation(() => ({ value: { payload: 'OFF' }, send: jest.fn() }));
  });

  test('shows an ActivityIndicator if not yet loaded', async () => {
    render(<Cameras />);
    expect(screen.queryByLabelText('Loading…')).toBeInTheDocument();
  });

  test('shows cameras', async () => {
    render(<Cameras />);

    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading…'));

    expect(screen.queryByText('front')).toBeInTheDocument();
    expect(screen.queryByText('front').closest('a')).toHaveAttribute('href', '/cameras/front');

    expect(screen.queryByText('side')).toBeInTheDocument();
    expect(screen.queryByText('side').closest('a')).toHaveAttribute('href', '/cameras/side');
  });

  test('shows recordings link', async () => {
    render(<Cameras />);

    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading…'));

    expect(screen.queryAllByText('Recordings')).toHaveLength(2);
  });

  test('buttons toggle detect, clips, and snapshots', async () => {
    const sendDetect = jest.fn();
    const sendRecordings = jest.fn();
    const sendSnapshots = jest.fn();
    jest.spyOn(Mqtt, 'useDetectState').mockImplementation(() => {
      return { payload: 'ON', send: sendDetect };
    });
    jest.spyOn(Mqtt, 'useRecordingsState').mockImplementation(() => {
      return { payload: 'OFF', send: sendRecordings };
    });
    jest.spyOn(Mqtt, 'useSnapshotsState').mockImplementation(() => {
      return { payload: 'ON', send: sendSnapshots };
    });

    render(<Cameras />);

    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading…'));

    fireEvent.click(screen.getAllByLabelText('Toggle detect off')[0]);
    expect(sendDetect).toHaveBeenCalledWith('OFF');
    expect(sendDetect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByLabelText('Toggle snapshots off')[0]);
    expect(sendSnapshots).toHaveBeenCalledWith('OFF');

    fireEvent.click(screen.getAllByLabelText('Toggle recordings on')[0]);
    expect(sendRecordings).toHaveBeenCalledWith('ON');

    expect(sendDetect).toHaveBeenCalledTimes(1);
    expect(sendSnapshots).toHaveBeenCalledTimes(1);
    expect(sendRecordings).toHaveBeenCalledTimes(1);
  });
});
